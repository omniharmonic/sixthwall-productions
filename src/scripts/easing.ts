/** Clamp `value` into [min, max]. */
export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * Position of `value` within [start, end], clamped to 0-1.
 * The workhorse of the whole timeline: every animated property is some
 * easing of some `segment()` of scroll progress.
 */
export const segment = (value: number, start: number, end: number): number =>
  clamp((value - start) / (end - start), 0, 1);

/** Cubic ease in-out — for moves that should start and stop softly. */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Cubic ease out — for things that arrive and settle. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * A bounded idle oscillation over `periodSec`, in [-1, 1].
 *
 * Idle motion must never be an unbounded accumulation of elapsed time. The
 * scroll timeline blends idle motion *away* as the visitor engages, and the
 * size of that blend is the size of the idle offset — so an accumulator that
 * grows without limit produces a correction that grows without limit.
 *
 * That was the "cube spins wildly if the page has been sitting" bug: yaw
 * drifted at 4.95°/s forever, and the first 20% of the scroll had to unwind
 * all of it. Sway instead of drift, and the worst case is the amplitude.
 */
export const sway = (seconds: number, periodSec: number): number =>
  Math.sin((seconds / periodSec) * Math.PI * 2);
