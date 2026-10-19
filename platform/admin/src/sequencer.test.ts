import { describe, expect, it } from 'vitest';
import { sequencer } from './sequencer';

describe('sequencer', () => {
  it('shows a fresh answer even while a later load is still running, then the later one', () => {
    const s = sequencer();
    const a = s.start();
    const b = s.start(); // started while a is in flight (e.g. a realtime event right after a save)
    expect(s.accept(a)).toBe(true); // a's data is newer than the empty screen: show it now
    expect(s.accept(b)).toBe(true); // b replaces it when it arrives
  });
  it('drops an answer older than the one on screen', () => {
    const s = sequencer();
    const a = s.start();
    const b = s.start();
    expect(s.accept(b)).toBe(true);
    expect(s.accept(a)).toBe(false); // slow older answer must not overwrite newer data
    expect(s.accept(b)).toBe(false); // the same answer is not applied twice
  });
});
