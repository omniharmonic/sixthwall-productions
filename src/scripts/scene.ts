/**
 * The scroll engine.
 *
 * One number drives the entire site: `p`, scroll progress from 0 to 1. Every
 * moving property is a pure function of it, so the page is fully scrubbable
 * and holds no animation state of its own between frames.
 *
 * The one thing that is *not* a function of `p` is the idle sway, which is a
 * function of elapsed time. It is deliberately bounded — see `sway()` in
 * easing.ts for why an unbounded one is a bug and not a style choice.
 *
 * Constants come from src/config/choreography.ts. Per-panel timings come off
 * the DOM (data-in / data-out / data-face), which is how the copy, the cube
 * faces and the chapter rail stay welded to one set of numbers authored in
 * src/content/panels/*.md.
 */
import { choreography as C } from '../config/choreography';
import { clamp, segment, easeInOut, easeOut, lerp, sway } from './easing';

type FlapName = keyof typeof C.flaps;

interface PanelTiming {
  element: HTMLElement;
  in: number;
  out: number;
}

/**
 * One cell of the net: a face of the cube, and the five extra walls that turn
 * that face into a cube of its own at the finale.
 *
 * `ring` is the number of cells between this one and the crossing, which is
 * what staggers the extrusion into a ripple travelling outward along the cross.
 */
interface Cell {
  ring: number;
  walls: HTMLElement[];
}

function must<T extends Element>(selector: string, within: ParentNode = document): T {
  const element = within.querySelector<T>(selector);
  if (!element) throw new Error(`scene.ts: expected to find "${selector}" in the document.`);
  return element;
}

/**
 * The net, as an upright Latin cross: the crossing, its four neighbours, and
 * the lid hanging one cell further south to make the foot.
 *
 * These positions are the cross *and* the hypercube. Fold them and they are a
 * cube; extrude them and they are six of the eight cells of a hypercube net.
 */
const NET_CELLS = [
  { id: 'f-base', column: 0, row: 0, ring: 0, origin: '' },
  { id: 'f-north', column: 0, row: -1, ring: 1, origin: '50% 100%' },
  { id: 'f-south', column: 0, row: 1, ring: 1, origin: '50% 0%' },
  { id: 'f-west', column: -1, row: 0, ring: 1, origin: '100% 50%' },
  { id: 'f-east', column: 1, row: 0, ring: 1, origin: '0% 50%' },
  /* Parented to the south flap, so folding the south flap carries it. Its
     left/top are therefore relative to that flap, not to the net. */
  { id: 'f-lid', column: 0, row: 2, ring: 2, origin: '50% 0%' },
] as const;

/** Walls in the order `extrude()` writes them. The face is the sixth, the front. */
const WALL_COUNT = 5;

export function mountScene(): void {
  const orbit = must<HTMLElement>('#orbit');
  const net = must<HTMLElement>('#net');
  const board = must<HTMLElement>('#board');
  const hero = must<HTMLElement>('#hero');
  const cue = must<HTMLElement>('#cue');
  const closing = must<HTMLElement>('#closing');
  const lattice = must<SVGSVGElement>('#lattice');

  const flaps = {
    north: must<HTMLElement>('#f-north'),
    south: must<HTMLElement>('#f-south'),
    west: must<HTMLElement>('#f-west'),
    east: must<HTMLElement>('#f-east'),
    lid: must<HTMLElement>('#f-lid'),
  } satisfies Record<FlapName, HTMLElement>;

  /** Faces of the net, ordered 0-5 to match each wall's `face` in frontmatter. */
  const faces = [...document.querySelectorAll<HTMLElement>('.face')].sort(
    (a, b) => Number(a.dataset.face) - Number(b.dataset.face),
  );

  const ticks = [...document.querySelectorAll<HTMLElement>('.rail i')];

  /* ── timings, read back off the rendered panels ─────────────────────── */

  const panels: PanelTiming[] = [...document.querySelectorAll<HTMLElement>('.panel')].map(
    (element) => ({
      element,
      in: Number(element.dataset.in),
      out: Number(element.dataset.out),
    }),
  );

  /**
   * When each cube face is lit, indexed by face. Derived from the panels that
   * declare a `face`, so a wall's copy and its light share one window.
   */
  const litWindows: Array<[number, number]> = [];
  for (const element of document.querySelectorAll<HTMLElement>('.panel[data-face]')) {
    litWindows[Number(element.dataset.face)] = [
      Number(element.dataset.in),
      Number(element.dataset.out),
    ];
  }

  /* ── geometry ───────────────────────────────────────────────────────── */

  /**
   * Current face edge. Read from CSS so JS and the breakpoint never disagree,
   * but cached: the render loop needs it every frame and getComputedStyle in a
   * rAF callback forces a layout flush.
   */
  let edge = 0;
  /** The orbit's own y within the frame, which the breakpoint also moves. */
  let originY = 0;
  const measure = (): void => {
    edge = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--S'));
    originY = orbit.offsetTop;
  };

  /** Adds the walls that let a cell be extruded from a square into a cube. */
  const addWalls = (host: HTMLElement, count: number): HTMLElement[] =>
    Array.from({ length: count }, () => {
      const wall = document.createElement('div');
      wall.className = 'wall';
      host.appendChild(wall);
      return wall;
    });

  const cells: Cell[] = NET_CELLS.map((spec) => ({
    ring: spec.ring,
    walls: addWalls(must<HTMLElement>(`#${spec.id}`), WALL_COUNT),
  }));

  /**
   * The two cells that exist only in four dimensions.
   *
   * Six cubes make the cross you can see; the hypercube's other two sit on the
   * front and back faces of the crossing — the only two directions a flat net
   * has left. They have no face of their own, so they are six walls and
   * nothing else, and they are built here rather than in the markup because
   * they are not part of the cube.
   */
  const makeCrossingCell = (): HTMLElement => {
    const element = document.createElement('div');
    element.className = 'cell';
    net.appendChild(element);
    return element;
  };

  const crossing = [makeCrossingCell(), makeCrossingCell()].map((element) => ({
    element,
    walls: addWalls(element, WALL_COUNT + 1),
  }));

  /**
   * Lays the net out as a cross: a crossing square, four flaps around it, and
   * the lid hinged off the far edge of the south flap. Transform origins are
   * the hinge lines, which is what lets a single rotation fold each flap up.
   */
  function layoutNet(): void {
    const half = edge / 2;

    for (const spec of NET_CELLS) {
      const element = must<HTMLElement>(`#${spec.id}`);

      if (spec.id === 'f-lid') {
        /* Relative to the south flap it hangs from, not to the net. */
        element.style.left = '0px';
        element.style.top = `${edge}px`;
      } else {
        element.style.left = `${spec.column * edge - half}px`;
        element.style.top = `${spec.row * edge - half}px`;
      }

      if (spec.origin) element.style.transformOrigin = spec.origin;
    }

    /* The crossing pair share the crossing's own footprint. */
    for (const { element } of crossing) {
      element.style.left = `${-half}px`;
      element.style.top = `${-half}px`;
    }
  }

  /**
   * Positions the walls of one cell for a given depth.
   *
   * The cell's front sits at `frontZ` and the box extrudes back from there, so
   * a net cell keeps its numbered face exactly where it has been all along and
   * grows away from the viewer. At depth 0 the side walls scale to nothing and
   * the back wall lies on the front, so the cell reads as the flat square it
   * was: the finale can therefore run on geometry that is present from the
   * first frame.
   */
  function extrude(walls: HTMLElement[], depth: number, frontZ: number, opacity: number): void {
    const k = depth / edge;
    const half = edge / 2;
    const mid = (frontZ - depth / 2).toFixed(2);

    const transforms = [
      `translateZ(${(frontZ - depth).toFixed(2)}px)`,
      `translateX(${half}px) translateZ(${mid}px) rotateY(90deg) scaleX(${k.toFixed(4)})`,
      `translateX(${-half}px) translateZ(${mid}px) rotateY(-90deg) scaleX(${k.toFixed(4)})`,
      `translateY(${-half}px) translateZ(${mid}px) rotateX(90deg) scaleY(${k.toFixed(4)})`,
      `translateY(${half}px) translateZ(${mid}px) rotateX(-90deg) scaleY(${k.toFixed(4)})`,
      `translateZ(${frontZ.toFixed(2)}px)`,
    ];

    const alpha = opacity.toFixed(3);
    walls.forEach((wall, index) => {
      wall.style.transform = transforms[index]!;
      wall.style.opacity = alpha;
    });
  }

  /**
   * Flower of life: overlapping circles on a triangular lattice, walked ring
   * by ring out from the centre.
   */
  function buildLattice(): void {
    const { rings, radius } = C.lattice;
    const centre = 50;
    const points: Array<[number, number]> = [[0, 0]];

    for (let ring = 1; ring <= rings; ring += 1) {
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const spokeAngle = (Math.PI / 3) * spoke;
        const edgeAngle = spokeAngle + (Math.PI / 3) * 2;
        for (let step = 0; step < ring; step += 1) {
          points.push([
            ring * Math.cos(spokeAngle) + step * Math.cos(edgeAngle),
            ring * Math.sin(spokeAngle) + step * Math.sin(edgeAngle),
          ]);
        }
      }
    }

    const ns = 'http://www.w3.org/2000/svg';
    for (const [x, y] of points) {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', String(centre + x * radius));
      circle.setAttribute('cy', String(centre + y * radius));
      circle.setAttribute('r', String(radius));
      lattice.appendChild(circle);
    }
  }

  measure();
  layoutNet();
  buildLattice();

  /* ── the loop ───────────────────────────────────────────────────────── */

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0;
  let current = 0;
  const startedAt = performance.now();

  function readScroll(): void {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  }

  function render(p: number, elapsedMs: number): void {
    const t = elapsedMs / 1000;

    /* flaps swing open on their hinges */
    for (const name of Object.keys(flaps) as FlapName[]) {
      const [from, to] = C.flaps[name];
      const open = easeInOut(segment(p, from, to));
      const { axis, closed } = C.flapAxis[name];
      flaps[name].style.transform = `${axis}(${(closed * (1 - open)).toFixed(2)}deg)`;
    }

    /* camera: tumble in → tilt back as the net opens → stand the cross up */
    const { orbit: O } = C;
    const settle = easeInOut(segment(p, ...O.settle));
    const unfold = easeInOut(segment(p, ...O.unfold));
    const flatten = easeInOut(segment(p, ...O.flatten));
    const final = easeInOut(segment(p, ...O.final));

    /**
     * Idle sway, bounded and detuned across the two axes so the pose never
     * quite repeats. It is faded out by `settle` rather than accumulated into
     * the pose, so the most it can ever cost the visitor on their first scroll
     * is its own amplitude — however long the page has been sitting there.
     */
    const idling = reducedMotion ? 0 : 1 - settle;
    const swayYaw = sway(t, O.idle.periodSec) * O.idle.yawDeg * idling;
    const swayTilt = sway(t, O.idle.periodSec * 1.618) * O.idle.tiltDeg * idling;

    let yaw = lerp(O.yaw.start, O.yaw.settled, settle);
    yaw = lerp(yaw, O.yaw.final, final);

    let tilt = lerp(O.tilt.start, O.tilt.unfolded, unfold);
    tilt = lerp(tilt, O.tilt.flattened, flatten);
    tilt = lerp(tilt, O.tilt.final, final);

    let roll = lerp(O.roll.start, O.roll.unfolded, unfold);
    roll = lerp(roll, O.roll.final, final);

    const scale = lerp(1, O.scale.onUnfold, unfold) * lerp(1, O.scale.onFinal, final);
    /* The finale raises the cross clear of the closing statement — but only
       as far as the frame allows. A short window has no headroom to give, and
       an unclamped lift slides the head of the cross under the masthead. The
       head sits one and a half cells above the crossing. */
    const wantedLift =
      lerp(0, O.liftPx, easeOut(segment(p, ...O.lift))) +
      lerp(0, O.finalLiftEdges * edge, final);
    const lowestLift = -Math.max(0, originY - 1.5 * edge * scale - O.headroomPx);
    const lift = Math.max(wantedLift, lowestLift);

    orbit.style.transform =
      `translateY(${lift.toFixed(1)}px) scale(${scale.toFixed(3)}) ` +
      `rotateX(${(tilt + swayTilt).toFixed(2)}deg) rotateY(${(yaw + swayYaw).toFixed(2)}deg) ` +
      `rotateZ(${roll.toFixed(2)}deg)`;

    /* the board flashes in as the net completes, then recedes */
    board.style.opacity = (
      C.board.peakOpacity *
      segment(p, ...C.board.in) *
      (1 - segment(p, ...C.board.out))
    ).toFixed(3);

    /* faces light in sequence with their copy */
    faces.forEach((face, index) => {
      const window = litWindows[index];
      if (!window) return;
      const bleed = C.panels.faceLightBleed;
      face.classList.toggle('lit', p >= window[0] - bleed && p < window[1] + bleed);
    });

    /* the finale: each cell of the net gains depth, the ripple travelling out
       from the crossing, and the hypercube's last two cells bud off its face */
    const { hypercube: H } = C;
    const fullDepth = edge * H.depth;
    let crossingDepth = 0;

    for (const cell of cells) {
      const offset = cell.ring * H.stagger;
      const grown = easeInOut(segment(p, H.extrude[0] + offset, H.extrude[1] + offset));
      if (cell.ring === 0) crossingDepth = fullDepth * grown;
      extrude(cell.walls, fullDepth * grown, 0, Math.min(1, grown * 5));
    }

    const budded = easeInOut(segment(p, ...H.crossing));
    const budDepth = fullDepth * budded;
    const budAlpha = Math.min(1, budded * 5);
    /* forward, out of the crossing's front face — the cube Dalí hangs a body
       in front of — and backward, out of its back face */
    extrude(crossing[0]!.walls, budDepth, budDepth, budAlpha);
    extrude(crossing[1]!.walls, budDepth, -crossingDepth, budAlpha);

    /* lattice resolves last */
    const latticeIn = easeOut(segment(p, ...C.lattice.reveal));
    lattice.style.opacity = (latticeIn * C.lattice.peakOpacity).toFixed(3);
    lattice.style.transform = `scale(${lerp(C.lattice.scale.from, C.lattice.scale.to, latticeIn).toFixed(3)})`;

    /* opening titles clear out of the way */
    const heroOut = segment(p, ...C.hero.fade);
    hero.style.opacity = (1 - heroOut).toFixed(3);
    hero.style.transform = `translateY(${(-heroOut * C.hero.liftPx).toFixed(1)}px)`;
    cue.style.opacity = (1 - segment(p, ...C.cue.fade)).toFixed(3);

    /* panels cross-fade, drifting slightly as they come and go */
    const { fadeDuration, driftPercent } = C.panels;
    for (const panel of panels) {
      const fadingIn = segment(p, panel.in, panel.in + fadeDuration);
      const fadingOut = 1 - segment(p, panel.out - fadeDuration, panel.out);
      const opacity = Math.min(fadingIn, fadingOut);
      const drift = (1 - fadingIn) * driftPercent - (1 - fadingOut) * driftPercent;

      panel.element.style.opacity = opacity.toFixed(3);
      panel.element.style.transform = `translateY(${-50 + drift}%)`;
      /* Hidden rather than merely transparent, so screen readers and hit
         testing skip the nine panels that are not currently on screen. */
      panel.element.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
    }

    closing.style.opacity = segment(p, ...C.closing.fade).toFixed(3);
    closing.style.pointerEvents = p > C.closing.interactiveAt ? 'auto' : 'none';

    ticks.forEach((tick, index) => {
      const window = litWindows[index];
      if (!window) return;
      tick.classList.toggle('on', p >= window[0] && p < window[1]);
    });
  }

  function frame(now: number): void {
    current += (target - current) * (reducedMotion ? 1 : C.smoothing);
    if (Math.abs(target - current) < C.settleEpsilon) current = target;
    render(current, now - startedAt);
    requestAnimationFrame(frame);
  }

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => {
    measure();
    layoutNet();
    readScroll();
  });

  readScroll();
  current = target;
  requestAnimationFrame(frame);
}
