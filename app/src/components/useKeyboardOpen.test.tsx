import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isKeyboardOpen, useKeyboardOpen } from './useKeyboardOpen';

function Probe() {
  useKeyboardOpen();
  return null;
}

describe('isKeyboardOpen', () => {
  it('needs a large height loss', () => {
    expect(isKeyboardOpen(740, 740)).toBe(false);
    expect(isKeyboardOpen(740, 650)).toBe(false);
    expect(isKeyboardOpen(740, 400)).toBe(true);
  });
});

describe('useKeyboardOpen', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'visualViewport', original);
    else Reflect.deleteProperty(window, 'visualViewport');
  });

  it('mirrors the keyboard state on <html data-keyboard>', () => {
    const vv = Object.assign(new EventTarget(), { height: window.innerHeight });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    render(<Probe />);
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
    act(() => {
      vv.height = window.innerHeight - 300;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement.dataset.keyboard).toBe('open');
    act(() => {
      vv.height = window.innerHeight;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.documentElement.dataset.keyboard).toBeUndefined();
  });
});
