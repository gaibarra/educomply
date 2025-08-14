import { useRef, useCallback } from 'react';

/**
 * Queue rapid calls and emit a single flush after debounce delay.
 * Returns a push function. On flush, it calls the provided handler with the queued payloads.
 */
export function useDebouncedEventQueue<T>(handler: (items: T[]) => void, delay = 250) {
  const timeoutRef = useRef<number | null>(null);
  const queueRef = useRef<T[]>([]);

  const push = useCallback((item: T) => {
    queueRef.current.push(item);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const items = [...queueRef.current];
      queueRef.current.length = 0;
      handler(items);
    }, delay);
  }, [delay, handler]);

  return push;
}
