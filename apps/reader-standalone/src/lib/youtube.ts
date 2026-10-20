import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface PlayerState {
  ready: boolean;
  playing: boolean;
  time: number;
  error: string | null;
  seek: (t: number) => void;
  currentTime: () => number;
}

let apiLoaded = false;
let apiLoading = false;
const apiWaiters: Array<() => void> = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded) return Promise.resolve();
  if (apiLoading) return new Promise((resolve) => apiWaiters.push(resolve));

  apiLoading = true;
  return new Promise((resolve) => {
    apiWaiters.push(resolve);
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiLoading = false;
      apiWaiters.forEach((fn) => fn());
      apiWaiters.length = 0;
    };
  });
}

export function useYouTube(containerRef: React.RefObject<HTMLDivElement>, videoId: string | null): PlayerState {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || !videoId) return;

    let mounted = true;
    const container = containerRef.current;

    (async () => {
      await loadYouTubeAPI();
      if (!mounted || !container) return;

      const div = document.createElement('div');
      container.innerHTML = '';
      container.appendChild(div);

      try {
        const player = new window.YT.Player(div, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (!mounted) return;
              setReady(true);
              setError(null);
            },
            onStateChange: (e) => {
              if (!mounted) return;
              if (e.data === window.YT.PlayerState.PLAYING) {
                setPlaying(true);
                if (intervalRef.current === null) {
                  intervalRef.current = window.setInterval(() => {
                    if (playerRef.current) {
                      setTime(playerRef.current.getCurrentTime());
                    }
                  }, 100);
                }
              } else {
                setPlaying(false);
                if (intervalRef.current !== null) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
              }
            },
            onError: (e) => {
              if (!mounted) return;
              const msgs: Record<number, string> = {
                2: '잘못된 영상 ID',
                5: 'HTML5 플레이어 오류',
                100: '영상을 찾을 수 없음',
                101: '영상을 재생할 수 없음',
                150: '영상을 재생할 수 없음',
              };
              setError(msgs[e.data] || '알 수 없는 오류');
            },
          },
        });
        playerRef.current = player;
      } catch (e) {
        if (mounted) setError('플레이어 초기화 실패');
      }
    })();

    return () => {
      mounted = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [containerRef, videoId]);

  const seek = (t: number) => {
    if (playerRef.current && ready) {
      playerRef.current.seekTo(t, true);
    }
  };

  const currentTime = () => {
    return playerRef.current?.getCurrentTime?.() || 0;
  };

  return { ready, playing, time, error, seek, currentTime };
}
