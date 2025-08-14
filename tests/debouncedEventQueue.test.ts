import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedEventQueue } from '../components/hooks/useDebouncedEventQueue';

const advanceTimers = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('useDebouncedEventQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('groups rapid events into single handler call', async () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useDebouncedEventQueue<number>(handler, 200));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });

    expect(handler).not.toHaveBeenCalled();
    await advanceTimers(199);
    expect(handler).not.toHaveBeenCalled();
    await advanceTimers(2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual([1,2,3]);
  });

  it('separate bursts trigger separate flushes', async () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useDebouncedEventQueue<number>(handler, 100));

    act(() => { result.current(1); });
    await advanceTimers(120); // flush first burst
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual([1]);

    act(() => { result.current(2); result.current(3); });
    await advanceTimers(101);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[1][0]).toEqual([2,3]);
  });
});
