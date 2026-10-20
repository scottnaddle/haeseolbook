import { describe, it, expect } from 'vitest';
import { inkChecksum, mergeInk, segmentAt, cueAt, type InkPage, type VideoSegment, type VideoCue } from '@hsb/shared';

describe('Grading and Ink Functions', () => {
  describe('inkChecksum', () => {
    it('should generate consistent checksums', () => {
      const ink: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          {
            id: 's1',
            tool: 'pen',
            color: '#000000',
            size: 0.003,
            points: [[0.1, 0.2, 0.5], [0.15, 0.25, 0.6]],
            videoTime: null,
            createdAt: 123456
          }
        ]
      };
      
      const checksum1 = inkChecksum(ink);
      const checksum2 = inkChecksum(ink);
      expect(checksum1).toBe(checksum2);
      expect(checksum1).toHaveLength(16);
    });

    it('should generate different checksums for different strokes', () => {
      const ink1: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          {
            id: 's1',
            tool: 'pen',
            color: '#000000',
            size: 0.003,
            points: [[0.1, 0.2, 0.5]],
            videoTime: null,
            createdAt: 123456
          }
        ]
      };
      
      const ink2: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          {
            id: 's2',
            tool: 'pen',
            color: '#000000',
            size: 0.003,
            points: [[0.2, 0.3, 0.5]],
            videoTime: null,
            createdAt: 123456
          }
        ]
      };
      
      expect(inkChecksum(ink1)).not.toBe(inkChecksum(ink2));
    });
  });

  describe('mergeInk', () => {
    it('should merge strokes from local and server', () => {
      const local: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          { id: 's1', tool: 'pen', color: '#000', size: 0.003, points: [[0.1, 0.1, 0.5]], videoTime: null, createdAt: 100 }
        ]
      };
      
      const server: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          { id: 's2', tool: 'pen', color: '#000', size: 0.003, points: [[0.2, 0.2, 0.5]], videoTime: null, createdAt: 200 }
        ]
      };
      
      const merged = mergeInk(local, server);
      expect(merged.strokes).toHaveLength(2);
      expect(merged.strokes[0].id).toBe('s1');
      expect(merged.strokes[1].id).toBe('s2');
    });

    it('should respect deleted ids', () => {
      const local: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          { id: 's1', tool: 'pen', color: '#000', size: 0.003, points: [[0.1, 0.1, 0.5]], videoTime: null, createdAt: 100 }
        ]
      };
      
      const server: InkPage = {
        version: 1,
        pageId: 'test',
        strokes: [
          { id: 's1', tool: 'pen', color: '#000', size: 0.003, points: [[0.1, 0.1, 0.5]], videoTime: null, createdAt: 100 },
          { id: 's2', tool: 'pen', color: '#000', size: 0.003, points: [[0.2, 0.2, 0.5]], videoTime: null, createdAt: 200 }
        ]
      };
      
      const merged = mergeInk(local, server, new Set(['s1']));
      expect(merged.strokes).toHaveLength(1);
      expect(merged.strokes[0].id).toBe('s2');
    });
  });

  describe('segmentAt', () => {
    const segments: VideoSegment[] = [
      { quizId: 'q1', youtubeId: 'abc', startSec: 10, endSec: 30, cues: [] },
      { quizId: 'q2', youtubeId: 'abc', startSec: 35, endSec: 60, cues: [] },
    ];

    it('should return correct segment for time in range', () => {
      expect(segmentAt(segments, 15)?.quizId).toBe('q1');
      expect(segmentAt(segments, 40)?.quizId).toBe('q2');
    });

    it('should return null for time outside all segments', () => {
      expect(segmentAt(segments, 5)).toBeNull();
      expect(segmentAt(segments, 65)).toBeNull();
    });
  });

  describe('cueAt', () => {
    const cues: VideoCue[] = [
      { t: 10, pageNo: 1, x: 0.1, y: 0.2 },
      { t: 20, pageNo: 1, x: 0.3, y: 0.4 },
    ];

    it('should return first cue for time before first cue', () => {
      expect(cueAt(cues, 5)).toBeNull();
    });

    it('should interpolate between cues', () => {
      const cue = cueAt(cues, 15);
      expect(cue).toBeDefined();
      expect(cue!.pageNo).toBe(1);
      expect(cue!.x).toBeCloseTo(0.2, 2);
      expect(cue!.y).toBeCloseTo(0.3, 2);
    });

    it('should return last cue for time after last cue', () => {
      const cue = cueAt(cues, 25);
      expect(cue).toBeDefined();
      expect(cue!.x).toBe(0.3);
      expect(cue!.y).toBe(0.4);
    });
  });
});
