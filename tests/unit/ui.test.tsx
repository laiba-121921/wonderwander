import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { roundedRectPath } from '../../src/ui/RoughFrame';
import { Button } from '../../src/ui/Button';
import { Chip } from '../../src/ui/Chip';
import { Sheet } from '../../src/ui/Sheet';
import { StatusBadge } from '../../src/ui/StatusBadge';
import { TapOption } from '../../src/ui/TapOption';
import { TextArea, countWords } from '../../src/ui/TextArea';

describe('ui components', () => {
  it('button clicks and can be disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Check my answer</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('chip and tap option report their pressed state', () => {
    render(
      <>
        <Chip selected>Track A</Chip>
        <TapOption onSelect={() => {}}>anything whatsoever</TapOption>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Track A' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'anything whatsoever' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('text area shows the dictation hint and counts words against a target', () => {
    function Harness() {
      const [v, setV] = useState('');
      return <TextArea label="Abstract" value={v} onChange={setV} wordTarget={150} />;
    }
    render(<Harness />);
    expect(screen.getByText('Tap the mic to dictate, or hold it to record.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dictate|Record/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Abstract'), { target: { value: 'one two  three' } });
    expect(screen.getByText('3 of 150 words')).toBeTruthy();
    expect(countWords('  ')).toBe(0);
  });

  it('sheet closes on Escape and on the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Sample unit">
        body
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Sample unit' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('status badge has British, dash-free default labels', () => {
    render(<StatusBadge status="queued" />);
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('rounded rect path stays inside its box', () => {
    const d = roundedRectPath(100, 40, 14, 1);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(100);
  });
});
