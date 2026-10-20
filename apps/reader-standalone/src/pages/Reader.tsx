import 'katex/dist/katex.min.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cueAt, segmentAt, type BookManifest, type InkPage, type Stroke } from '@hsb/shared';
import * as db from '../lib/db';
import { useYouTube } from '../lib/youtube';
import { HIGHLIGHT_COLORS, HIGHLIGHT_SIZE, PEN_COLORS, PEN_SIZES, type Tool } from '../reader/ink';
import { PageView } from '../reader/PageView';
import { QuizPanel, type PanelTab } from '../reader/QuizPanel';

interface HistoryOp { pageId: string; before: Stroke[]; after: Stroke[] }

const SIDE_KEY = 'hsb.sideWidth';
const SIDE_MIN = 320;

class InkManager {
  private cache = new Map<string, Stroke[]>();
  private listeners = new Set<() => void>();

  constructor(private bookId: string) {}

  async load(pageId: string): Promise<Stroke[]> {
    if (this.cache.has(pageId)) return this.cache.get(pageId)!;
    const local = await db.getInk(this.bookId, pageId);
    const strokes = local?.ink.strokes || [];
    this.cache.set(pageId, strokes);
    return strokes;
  }

  async setStrokes(pageId: string, strokes: Stroke[], removedIds: string[]): Promise<void> {
    this.cache.set(pageId, strokes);
    const ink: InkPage = { version: 1, pageId, strokes };
    const local: db.LocalInk = {
      key: db.inkKey(this.bookId, pageId),
      bookId: this.bookId,
      pageId,
      ink,
      updatedAt: Date.now(),
      deletedIds: removedIds,
    };
    await db.putInk(local);
    this.notify();
  }

  strokes(pageId: string): Stroke[] {
    return this.cache.get(pageId) || [];
  }

  allStrokes(): { pageId: string; stroke: Stroke }[] {
    const result: { pageId: string; stroke: Stroke }[] = [];
    for (const [pageId, strokes] of this.cache) {
      for (const stroke of strokes) {
        result.push({ pageId, stroke });
      }
    }
    return result;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

function Splitter({ onWidth }: { onWidth: (w: number | null) => void }) {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => onWidth(Math.round(Math.min(Math.max(ev.clientX, SIDE_MIN), window.innerWidth - 420)));
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return <div className="splitter" role="separator" aria-orientation="vertical" aria-label="영상 패널 폭 조절"
    onPointerDown={onPointerDown} onDoubleClick={() => onWidth(null)} />;
}

function pageTop(scroller: HTMLElement, page: HTMLElement): number {
  return scroller.scrollTop + page.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
}

export function Reader() {
  const { bookId = '' } = useParams();
  const [m, setM] = useState<BookManifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inkMgr, setInkMgr] = useState<InkManager | null>(null);
  const [, bump] = useState(0);

  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[1]);
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [fingerDraw, setFingerDraw] = useState(true);
  const [follow, setFollow] = useState(true);
  const [tab, setTab] = useState<PanelTab>('quiz');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(new Map<string, db.QuizAttempt>());
  const [lastResult, setLastResult] = useState<{ quizId: string; chosen: number; correct: boolean } | null>(null);
  const undo = useRef<HistoryOp[]>([]);
  const redo = useRef<HistoryOp[]>([]);
  const [imageUrls, setImageUrls] = useState(new Map<string, string>());

  const scroller = useRef<HTMLDivElement>(null);
  const [sideW, setSideW] = useState<number | null>(() => {
    try { const v = Number(localStorage.getItem(SIDE_KEY)); return v >= SIDE_MIN ? v : null; } catch { return null; }
  });
  const playerBox = useRef<HTMLDivElement>(null);
  const player = useYouTube(playerBox, videoId);
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const manifest = await db.loadManifest(bookId);
      if (!manifest) {
        setErr('교재를 찾을 수 없습니다.');
        return;
      }
      if (!mounted) return;
      setM(manifest);
      setVideoId(manifest.videoSegments[0]?.youtubeId ?? null);
      
      const mgr = new InkManager(bookId);
      const off = mgr.subscribe(() => bump(n => n + 1));
      setInkMgr(mgr);

      for (const page of manifest.pages) {
        await mgr.load(page.id);
      }

      for (const page of manifest.pages) {
        for (const size of ['xs', 'sm', 'hi'] as const) {
          const blob = await db.getPageImage(bookId, page.id, size);
          if (blob && mounted) {
            const url = URL.createObjectURL(blob);
            setImageUrls(prev => new Map(prev).set(`${page.id}:${size}`, url));
          }
        }
      }

      const loadedAttempts = await db.listAttempts(bookId);
      if (mounted) {
        setAttempts(new Map(loadedAttempts.map(a => [a.quizId, a])));
      }

      return () => {
        mounted = false;
        off();
      };
    })();
  }, [bookId]);

  const quizzes = m?.quizzes ?? [];
  const segments = useMemo(() => {
    const map = new Map<string, BookManifest['videoSegments'][0]>();
    for (const v of m?.videoSegments ?? []) map.set(v.quizId, v);
    return map;
  }, [m]);
  const solutions = useMemo(() => {
    const map = new Map<string, BookManifest['solutions'][0]>();
    for (const s of m?.solutions ?? []) map.set(s.quizId, s);
    return map;
  }, [m]);
  const pageNoById = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of m?.pages ?? []) map.set(p.id, p.pageNo);
    return map;
  }, [m]);
  const regionsByPage = useMemo(() => {
    const map = new Map<string, BookManifest['regions']>();
    for (const r of m?.regions ?? []) map.set(r.pageId, [...(map.get(r.pageId) ?? []), r]);
    return map;
  }, [m]);

  const scrollToQuiz = useCallback((quizId: string) => {
    const r = m?.regions.find((x) => x.quizId === quizId && x.kind === 'quiz');
    const el = r && scroller.current?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(r.pageId)}"]`);
    if (!r || !el || !scroller.current) return;
    const top = pageTop(scroller.current, el) + r.bbox.y * el.clientHeight - 24;
    scroller.current.scrollTo({ top, behavior: 'smooth' });
  }, [m]);

  const videoSegs = useMemo(() => (m?.videoSegments ?? []).filter((v: { youtubeId: string }) => v.youtubeId === videoId), [m, videoId]);
  const playingSeg = player.ready ? segmentAt(videoSegs, player.time) : null;
  useEffect(() => {
    if (!player.playing || !playingSeg || playingSeg.quizId === activeQuizId) return;
    setActiveQuizId(playingSeg.quizId);
    if (follow) scrollToQuiz(playingSeg.quizId);
  }, [player.playing, playingSeg, activeQuizId, follow, scrollToQuiz]);

  const cue = playingSeg ? cueAt(playingSeg.cues, player.time) : null;
  const cuePageId = cue ? m?.pages.find((p) => p.pageNo === cue.pageNo)?.id : undefined;

  const selectQuiz = useCallback((quizId: string, seek: boolean) => {
    setActiveQuizId(quizId);
    setTab('quiz');
    const seg = segments.get(quizId);
    if (seek && seg) {
      if (seg.youtubeId !== videoId) setVideoId(seg.youtubeId);
      playerRef.current.seek(seg.startSec);
    }
    scrollToQuiz(quizId);
  }, [segments, videoId, scrollToQuiz]);

  const onRegionTap = useCallback((quizId: string) => selectQuiz(quizId, true), [selectQuiz]);

  const onStrokeTap = useCallback((s: Stroke) => {
    if (s.videoTime !== null) playerRef.current.seek(s.videoTime);
  }, []);

  const onNote = useCallback((pageId: string, s: Stroke) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(pageId)}"]`);
    if (el && scroller.current) {
      const y = Math.min(...s.points.map((pt) => pt[1]));
      scroller.current.scrollTo({ top: pageTop(scroller.current, el) + y * el.clientHeight - 80, behavior: 'smooth' });
    }
    if (s.videoTime !== null) playerRef.current.seek(s.videoTime);
  }, []);

  const onChange = useCallback((pageId: string, strokes: Stroke[], removed: string[]) => {
    if (!inkMgr) return;
    undo.current.push({ pageId, before: inkMgr.strokes(pageId), after: strokes });
    if (undo.current.length > 200) undo.current.shift();
    redo.current = [];
    void inkMgr.setStrokes(pageId, strokes, removed);
  }, [inkMgr]);

  const applyHistory = (from: React.MutableRefObject<HistoryOp[]>, to: React.MutableRefObject<HistoryOp[]>, dir: 'undo' | 'redo') => {
    const op = from.current.pop();
    if (!op || !inkMgr) return;
    to.current.push(op);
    const next = dir === 'undo' ? op.before : op.after;
    const removed = inkMgr.strokes(op.pageId).filter((s) => !next.some((n) => n.id === s.id)).map((s) => s.id);
    void inkMgr.setStrokes(op.pageId, next, removed);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) applyHistory(redo, undo, 'redo'); else applyHistory(undo, redo, 'undo');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onPenDetected = useCallback(() => setFingerDraw(false), []);
  const videoTime = useCallback(() => playerRef.current.currentTime(), []);

  const onAnswer = async (quizId: string, chosen: number) => {
    const q = quizzes.find((x) => x.id === quizId);
    if (!q) return;
    const correct = q.answer === chosen;
    setLastResult({ quizId, chosen, correct });
    const prev = attempts.get(quizId);
    const newAttempt: db.QuizAttempt = {
      key: db.attemptKey(bookId, quizId),
      bookId,
      quizId,
      chosen,
      correct,
      tries: (prev?.tries ?? 0) + 1,
      everWrong: (prev?.everWrong ?? false) || !correct,
      lastAttemptAt: Date.now(),
    };
    setAttempts(new Map(attempts).set(quizId, newAttempt));
    await db.putAttempt(newAttempt);
  };

  const notes = useMemo(() => {
    const allStrokes = inkMgr?.allStrokes() ?? [];
    return allStrokes
      .filter((n) => n.stroke.videoTime !== null)
      .sort((a, b) => a.stroke.videoTime! - b.stroke.videoTime!)
      .map((n) => ({ ...n, pageNo: pageNoById.get(n.pageId) ?? 0 }));
  }, [inkMgr, pageNoById, bump]);

  if (err) return <div className="center-msg"><p>{err}</p><Link to="/">서재로</Link></div>;
  if (!m || !inkMgr) return <div className="center-msg"><p>교재를 여는 중…</p></div>;

  const color = tool === 'highlighter' ? hlColor : penColor;
  const size = tool === 'highlighter' ? HIGHLIGHT_SIZE : penSize;

  return (
    <div className="reader">
      <header className="reader-top">
        <Link to="/" className="back" aria-label="서재로">←</Link>
        <div className="title"><b>{m.book.title}</b><small>{m.book.exam} · {m.book.subject}</small></div>
        <span className="sync idle">로컬 전용</span>
      </header>

      <div className="reader-body" style={sideW ? ({ '--side-w': `${sideW}px` } as React.CSSProperties) : undefined}>
        <aside className="side">
          <div className="video">
            <div ref={playerBox} className="video-box" />
            {!videoId && <div className="video-empty">이 교재에는 해설 영상이 없습니다</div>}
            {player.error && <div className="video-empty">{player.error}</div>}
          </div>
          <label className="follow"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 영상 따라 원문 자동 이동</label>
          <QuizPanel
            tab={tab} onTab={setTab} quizzes={quizzes} solutions={solutions} segments={segments} attempts={attempts}
            activeQuizId={activeQuizId} lastResult={lastResult} notes={notes}
            onSelect={selectQuiz} onAnswer={onAnswer} onNote={onNote}
          />
        </aside>
        <Splitter onWidth={(w) => { setSideW(w); try { if (w) localStorage.setItem(SIDE_KEY, String(w)); else localStorage.removeItem(SIDE_KEY); } catch { /* */ } }} />

        <main className="pages-col">
          <div className="toolbar" role="toolbar" aria-label="필기 도구">
            {([['view', '보기', ''], ['pen', '펜', ''], ['highlighter', '형광펜', ''], ['eraser', '지우개', '']] as const).map(([t, label, tip]) => (
              <button key={t} className={tool === t ? 'on' : ''} onClick={() => setTool(t)} title={tip}>{label}</button>
            ))}
            <span className="sep" />
            {(tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS).map((c) => (
              <button key={c} className={`swatch-btn ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`색 ${c}`}
                onClick={() => (tool === 'highlighter' ? setHlColor(c) : (setPenColor(c), tool !== 'pen' && setTool('pen')))} />
            ))}
            {tool === 'pen' && PEN_SIZES.map((s, i) => (
              <button key={s} className={`size-btn ${penSize === s ? 'on' : ''}`} onClick={() => setPenSize(s)} aria-label={`굵기 ${i + 1}`}>
                <i style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
              </button>
            ))}
            <span className="sep" />
            <button onClick={() => applyHistory(undo, redo, 'undo')} aria-label="실행 취소">↶</button>
            <button onClick={() => applyHistory(redo, undo, 'redo')} aria-label="다시 실행">↷</button>
            <label className="finger">
              <input type="checkbox" checked={fingerDraw} onChange={(e) => setFingerDraw(e.target.checked)} /> 손가락 필기
            </label>
          </div>
          <div ref={scroller} className="pages">
            {m.pages.map((pg: BookManifest['pages'][0]) => {
              const imgUrl = imageUrls.get(`${pg.id}:sm`) || imageUrls.get(`${pg.id}:hi`) || imageUrls.get(`${pg.id}:xs`) || '';
              return (
                <PageView
                  key={pg.id}
                  page={pg}
                  imageUrl={imgUrl}
                  regions={regionsByPage.get(pg.id) ?? []}
                  strokes={inkMgr.strokes(pg.id)}
                  tool={tool}
                  color={color}
                  size={size}
                  fingerDraw={fingerDraw}
                  activeQuizId={activeQuizId}
                  cue={cuePageId === pg.id ? cue : null}
                  videoTime={videoTime}
                  onPenDetected={onPenDetected}
                  onChange={onChange}
                  onRegionTap={onRegionTap}
                  onStrokeTap={onStrokeTap}
                  scroller={scroller}
                />
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
