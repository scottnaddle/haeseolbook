import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Page, Region, Stroke, VideoCue } from '@hsb/shared';
import { drawStrokes, hitStrokes, newStrokeId, type Tool } from './ink';

export interface PageViewProps {
  page: Page;
  imageUrl: string;
  regions: Region[];
  strokes: Stroke[];
  tool: Tool;
  color: string;
  size: number;
  fingerDraw: boolean;
  activeQuizId: string | null;
  cue: VideoCue | null;
  videoTime: () => number | null;
  onPenDetected: () => void;
  onChange: (pageId: string, strokes: Stroke[], removedIds: string[]) => void;
  onRegionTap: (quizId: string) => void;
  onStrokeTap: (stroke: Stroke) => void;
  scroller: React.RefObject<HTMLElement>;
}

function PageViewImpl(p: PageViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const drawing = useRef<{ id: number; stroke: Stroke | null; erased: Set<string>; panY?: number; panX?: number } | null>(null);
  const aspect = p.page.height / p.page.width;

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pxW = Math.min(4096, Math.round(width * dpr));
  const pxH = Math.round(pxW * aspect);

  useEffect(() => {
    const c = base.current;
    if (!c || !pxW) return;
    c.width = pxW;
    c.height = pxH;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, pxW, pxH);
    const erased = drawing.current?.erased;
    drawStrokes(ctx, erased?.size ? p.strokes.filter((s) => !erased.has(s.id)) : p.strokes, pxW, pxH);
    if (live.current) { live.current.width = pxW; live.current.height = pxH; }
  }, [p.strokes, pxW, pxH]);

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = live.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as const;
  };

  const redrawBaseWithout = (erased: Set<string>) => {
    const ctx = base.current!.getContext('2d')!;
    ctx.clearRect(0, 0, pxW, pxH);
    drawStrokes(ctx, p.strokes.filter((s) => !erased.has(s.id)), pxW, pxH);
  };

  const eraseAt = (x: number, y: number) => {
    const d = drawing.current!;
    const hit = hitStrokes(p.strokes.filter((s) => !d.erased.has(s.id)), x, y, 0.012, aspect);
    if (hit.length) {
      hit.forEach((s) => d.erased.add(s.id));
      redrawBaseWithout(d.erased);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (p.tool === 'view' || drawing.current) return;
    if (e.pointerType === 'pen') p.onPenDetected();
    const fingerPan = e.pointerType === 'touch' && !p.fingerDraw;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (fingerPan) {
      drawing.current = { id: e.pointerId, stroke: null, erased: new Set(), panY: e.clientY, panX: e.clientX };
      return;
    }
    const [x, y] = norm(e);
    drawing.current = { id: e.pointerId, stroke: null, erased: new Set() };
    if (p.tool === 'eraser') return eraseAt(x, y);
    const vt = p.videoTime();
    drawing.current.stroke = {
      id: newStrokeId(), tool: p.tool, color: p.color, size: p.size,
      points: [[x, y, e.pressure || 0.5]], videoTime: vt === null ? null : Math.round(vt * 10) / 10, createdAt: Date.now(),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.panY !== undefined) {
      p.scroller.current?.scrollBy({ top: d.panY - e.clientY, left: (d.panX ?? e.clientX) - e.clientX });
      d.panY = e.clientY;
      d.panX = e.clientX;
      return;
    }
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    if (p.tool === 'eraser') {
      for (const ev of events) eraseAt(...norm(ev));
      return;
    }
    if (!d.stroke) return;
    for (const ev of events) {
      const [x, y] = norm(ev);
      const last = d.stroke.points[d.stroke.points.length - 1];
      if (Math.abs(last[0] - x) + Math.abs(last[1] - y) < 0.0008) continue;
      if (d.stroke.points.length < 4999) d.stroke.points.push([round(x), round(y), round(ev.pressure || 0.5)]);
    }
    const ctx = live.current!.getContext('2d')!;
    ctx.clearRect(0, 0, pxW, pxH);
    drawStrokes(ctx, [d.stroke], pxW, pxH, true);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (!d || d.id !== e.pointerId) return;
    drawing.current = null;
    live.current?.getContext('2d')?.clearRect(0, 0, pxW, pxH);
    if (d.stroke) p.onChange(p.page.id, [...p.strokes, d.stroke], []);
    else if (d.erased.size) p.onChange(p.page.id, p.strokes.filter((s) => !d.erased.has(s.id)), [...d.erased]);
  };

  const onClick = (e: React.MouseEvent) => {
    if (p.tool !== 'view') return;
    const [x, y] = norm(e);
    const hit = hitStrokes(p.strokes.filter((s) => s.videoTime !== null), x, y, 0.015, aspect).pop();
    if (hit) return p.onStrokeTap(hit);
    const region = p.regions.find((r) => r.quizId && x >= r.bbox.x && x <= r.bbox.x + r.bbox.w && y >= r.bbox.y && y <= r.bbox.y + r.bbox.h);
    if (region?.quizId) p.onRegionTap(region.quizId);
  };

  return (
    <div ref={wrap} className="page" style={{ aspectRatio: `${p.page.width} / ${p.page.height}` }} data-page-id={p.page.id}>
      {visible && <img src={p.imageUrl} alt={`${p.page.pageNo}쪽`} draggable={false} />}
      <svg className="page-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden>
        {p.regions.filter((r) => r.quizId).map((r) => (
          <rect key={r.id} x={r.bbox.x * 1000} y={r.bbox.y * 1000} width={r.bbox.w * 1000} height={r.bbox.h * 1000}
            className={r.quizId === p.activeQuizId ? 'region active' : 'region'} rx="4" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {p.cue && <div className="cue-dot" style={{ left: `${p.cue.x * 100}%`, top: `${p.cue.y * 100}%` }} />}
      <canvas ref={base} className="ink" />
      <canvas
        ref={live}
        className={`ink live tool-${p.tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
      />
      <span className="page-no">{p.page.pageNo}</span>
    </div>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;

export const PageView = memo(PageViewImpl);
