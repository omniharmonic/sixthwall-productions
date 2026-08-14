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
