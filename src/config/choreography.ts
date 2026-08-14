/**
 * The scroll choreography, in one place.
 *
 * The whole site is a single timeline. `p` is scroll progress, 0 → 1, and
 * every moving part is a function of it. In the original mockup these numbers
 * were scattered through the render loop and repeated in three places; here
 * they are named, typed and grouped so a change reads as an intention
 * ("the cube settles later") rather than as an unexplained decimal.
 *
 * A `Window` is a [start, end] pair on that 0 → 1 timeline.
 *
 * NOTE: panel timings are deliberately NOT here. Each panel owns its own
 * `scrollIn`/`scrollOut` in src/content/panels/*.md, so moving a wall moves
 * its copy, its cube face and its rail tick together. See src/scripts/scene.ts.
 */

export type Window = readonly [start: number, end: number];

export const choreography = {
  /** Total scrollable length. More height = slower, more deliberate pacing. */
  scrollLength: '940vh',

  /** How hard scroll input is smoothed. Lower = heavier, more cinematic lag. */
  smoothing: 0.085,

  /** Below this delta the eased value snaps, so we stop repainting. */
  settleEpsilon: 0.00008,

  /**
   * When each flap of the cube net swings open. The cube is a cross-shaped
   * net: four flaps around a base, plus a lid hinged off the north flap.
   */
  flaps: {
    north: [0.15, 0.222],
    south: [0.245, 0.317],
    west: [0.34, 0.412],
    east: [0.435, 0.507],
    lid: [0.53, 0.602],
  } satisfies Record<string, Window>,

  /** Which axis each flap rotates on, and its closed angle in degrees. */
  flapAxis: {
    north: { axis: 'rotateX', closed: -90 },
    south: { axis: 'rotateX', closed: 90 },
    west: { axis: 'rotateY', closed: 90 },
    east: { axis: 'rotateY', closed: -90 },
    lid: { axis: 'rotateX', closed: -90 },
  },

  /** The camera move: tumble in, tilt back as it unfolds, then face the viewer. */
  orbit: {
    settle: [0.04, 0.2] as Window,
    unfold: [0.14, 0.62] as Window,
    flatten: [0.6, 0.74] as Window,
    final: [0.9, 1.0] as Window,
    lift: [0.6, 0.8] as Window,

    /** Idle rotation, degrees/sec. Suppressed under prefers-reduced-motion. */
    driftRate: 5.5,

    yaw: { from: -24, to: 0, driftFactor: 0.9 },
    /** Tilt is lerped through these in order: start → unfolded → flat → head-on. */
    tilt: { start: -16, unfolded: -54, flattened: -9, final: 0 },
    roll: { onUnfold: 26, onFinal: 10, spinRate: 0.5 },
    scale: { onUnfold: 0.6, onFinal: 0.82 },
    liftPx: -40,
  },

  /** The checkered floor that flashes in as the net completes, then recedes. */
  board: {
    in: [0.6, 0.68] as Window,
    out: [0.78, 0.9] as Window,
    peakOpacity: 0.11,
  },

  /** Mini cubes blooming out of each net cell, staggered. */
  minis: {
    bloom: [0.575, 0.655] as Window,
    /** Added to both ends of `bloom` per cube index, for the cascade. */
    stagger: 0.014,
    fadeOut: [0.93, 1.0] as Window,
    fadeAmount: 0.45,
    scale: { from: 0.2, to: 1.0 },
    spinRate: 9,
    /** Degrees of phase offset per cube, so they never spin in lockstep. */
    spinOffset: 47,
  },

  /** Flower-of-life lattice, the final image. */
  lattice: {
    reveal: [0.9, 1.0] as Window,
    peakOpacity: 0.95,
    scale: { from: 0.72, to: 1.0 },
    /** Rings of circles around the centre. 2 = 19 circles. */
    rings: 2,
    radius: 11,
  },

  /** Opening titles. */
  hero: {
    fade: [0.005, 0.045] as Window,
    liftPx: 26,
  },

  /** The "Scroll" prompt. */
  cue: {
    fade: [0.002, 0.022] as Window,
  },

  /** Copy panels: how long each cross-fades, and how far it drifts while doing so. */
  panels: {
    fadeDuration: 0.022,
    driftPercent: 3.5,
    /** Faces stay lit slightly beyond their panel's window, so the light leads the copy. */
    faceLightBleed: 0.02,
  },

  /** Closing statement and call to action. */
  closing: {
    fade: [0.955, 0.995] as Window,
    /** Past this point the CTA becomes clickable. */
    interactiveAt: 0.97,
  },
} as const;

export type Choreography = typeof choreography;
