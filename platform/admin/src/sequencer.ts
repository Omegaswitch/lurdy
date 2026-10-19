// Orders the answers of overlapping loads: an answer is shown when it is newer than the one on screen, even while a
// later load is still on its way (that one replaces it when it arrives); an answer older than what is shown is dropped.
// Waiting for the very latest load instead would leave the screen stale for as long as one slow request takes.
export function sequencer() {
  let started = 0;
  let shown = 0;
  return {
    start: () => ++started,
    accept: (n: number) => { if (n <= shown) return false; shown = n; return true; },
  };
}
