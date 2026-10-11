import { act, renderHook } from '@testing-library/react';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-11T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('starts at the current time and refreshes every interval', () => {
    const { result } = renderHook(() => useNow(60_000));
    const start = result.current;
    expect(start).toBe(Date.parse('2026-10-11T10:00:00Z'));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(start + 60_000);
    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    expect(result.current).toBe(start + 4 * 60_000);
  });

  it('refreshes when the page becomes visible again', () => {
    const { result } = renderHook(() => useNow(10 * 60_000));
    const start = result.current;
    vi.setSystemTime(start + 3_600_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(start + 3_600_000);
  });

  it('stops its timer on unmount', () => {
    const { unmount } = renderHook(() => useNow(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
