import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceRound } from './ChoiceRound';

const options = ['a', 'b', 'c', 'd'].map((k, i) => ({ key: k, content: k, correct: i === 2 }));

describe('ChoiceRound keyboard shortcuts (QA-028)', () => {
  it('keys 1-4 pick the option in that position; a wrong one is disabled', async () => {
    const onDone = vi.fn();
    const onReport = vi.fn();
    render(<ChoiceRound prompt="?" options={options} onReport={onReport} onDone={onDone} />);
    const u = userEvent.setup();
    await u.keyboard('1');
    expect(screen.getByRole('button', { name: 'a' })).toBeDisabled();
    expect(onReport).toHaveBeenCalledWith(false);
    await u.keyboard('3');
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('ignores the keys while an input is focused', async () => {
    const onDone = vi.fn();
    render(
      <>
        <input aria-label="campo" />
        <ChoiceRound prompt="?" options={options} onReport={() => undefined} onDone={onDone} />
      </>,
    );
    const u = userEvent.setup();
    await u.click(screen.getByLabelText('campo'));
    await u.keyboard('3');
    expect(onDone).not.toHaveBeenCalled();
  });
});
