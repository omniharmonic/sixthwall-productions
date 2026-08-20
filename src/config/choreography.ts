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
  scrollLength: '1180vh',

  /** How hard scroll input is smoothed. Lower = heavier, more cinematic lag. */
  smoothing: 0.085,

  /** Below this delta the eased value snaps, so we stop repainting. */
  settleEpsilon: 0.00008,

  /**
   * When each flap of the cube net swings open. The cube is a cross-shaped
   * net: four flaps around a base, plus a lid hinged off the north flap.
   */
  flaps: {
    north: [0.1286, 0.186],
    south: [0.2043, 0.2617],
    west: [0.28, 0.3374],
    east: [0.3557, 0.413],
    lid: [0.4314, 0.4887],
  } satisfies Record<string, Window>,

  /**
   * Which axis each flap rotates on, and its closed angle in degrees.
   *
   * The lid hinges off the *south* flap, which is what makes the open net an
   * upright Latin cross — one cell above the crossing, two below — rather than
   * that cross stood on its head. See the hypercube note below.
   */
  flapAxis: {
    north: { axis: 'rotateX', closed: -90 },
    south: { axis: 'rotateX', closed: 90 },
    west: { axis: 'rotateY', closed: 90 },
    east: { axis: 'rotateY', closed: -90 },
    lid: { axis: 'rotateX', closed: 90 },
  },

  /** The camera move: tumble in, tilt back as it unfolds, then face the viewer. */
  orbit: {
    settle: [0.04, 0.1685] as Window,
    unfold: [0.1207, 0.5031] as Window,
    flatten: [0.4871, 0.6545] as Window,
    /* Overlaps the extrusion below on purpose: the cross standing upright and
       the faces gaining depth are one move, not two. */
    final: [0.794, 0.9801] as Window,
    lift: [0.4871, 0.7342] as Window,

    /**
     * Idle motion while the page waits at the top: a slow bounded sway, not a
     * drift. Amplitude in degrees, period in seconds; the two axes are detuned
     * against each other in scene.ts so the pose never repeats exactly.
     *
     * Amplitude is the whole safety property here. Scroll blends this away, so
     * whatever is written here is the most the cube can ever have to unwind
     * when the visitor starts scrolling. Keep it small. Suppressed under
     * prefers-reduced-motion.
     */
    idle: { yawDeg: 8, tiltDeg: 2.4, periodSec: 21 },

    /* Each pose is lerped through its stages in order. Every stage ends at a
       value written here, so the final frame is the same frame every time. */
    yaw: { start: -24, settled: 0, final: -15 },
    tilt: { start: -16, unfolded: -54, flattened: -9, final: -8 },
    roll: { start: 0, unfolded: 26, final: 0 },
    scale: { onUnfold: 0.6, onFinal: 0.83 },
    liftPx: -40,
    /**
     * Extra lift at the finale, in face edges rather than pixels.
     *
     * The cross hangs two cells below its crossing and one above, so left
     * where it is it sits low and its crossbar cuts through the closing
     * statement. Raised, the arms clear the copy and the shaft runs down
     * behind it. In *edges* because the correction is a fact about the
     * cross's geometry, and the edge shrinks at the mobile breakpoint — a
     * pixel constant here lifts the small cross into the masthead.
     */
    finalLiftEdges: -0.72,
    /**
     * Clearance kept between the head of the risen cross and the top of the
     * frame. The lift above is what the composition wants; this is what the
     * window can actually give, and on a short viewport it wins.
     */
    headroomPx: 50,
  },

  /** The checkered floor that flashes in as the net completes, then recedes. */
  board: {
    in: [0.4871, 0.5748] as Window,
    out: [0.7077, 0.8671] as Window,
    peakOpacity: 0.11,
  },

  /**
   * The finale: every cell of the net gains depth, and the cross of six
   * squares becomes a cross of cubes — the unfolded hypercube of Dalí's
   * *Corpus Hypercubus*.
   *
   * A cube net is six squares; a hypercube net is eight cubes. The six come
   * from the faces we already have. The other two sit on the front and back
   * of the crossing cell — the only two directions a flat net has left — and
   * so they cannot exist until the crossing has depth to grow out of.
   */
  hypercube: {
    extrude: [0.7542, 0.907] as Window,
    /** Added to both ends of `extrude` per ring of cells out from the crossing. */
    stagger: 0.022,
    /** The pair budding off the crossing's own two faces. */
    crossing: [0.8073, 0.9535] as Window,
    /** Depth of a finished cell, as a fraction of the face edge. 1 = a cube. */
    depth: 1,
  },

  /** Flower-of-life lattice, the final image. */
  lattice: {
    reveal: [0.8671, 1] as Window,
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
    fadeDuration: 0.018,
    driftPercent: 3.5,
    /** Faces stay lit slightly beyond their panel's window, so the light leads the copy. */
    faceLightBleed: 0.02,
  },

  /** Closing statement and call to action. */
  closing: {
    fade: [0.9402, 0.9934] as Window,
    /** Past this point the CTA becomes clickable. */
    interactiveAt: 0.9601,
  },
} as const;

export type Choreography = typeof choreography;
