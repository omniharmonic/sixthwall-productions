/**
 * The scroll engine.
 *
 * One number drives the entire site: `p`, scroll progress from 0 to 1. Every
 * moving property is a pure function of it, so the page is fully scrubbable
 * and holds no animation state of its own between frames.
 *
 * Constants come from src/config/choreography.ts. Per-panel timings come off
 * the DOM (data-in / data-out / data-face), which is how the copy, the cube
 * faces and the chapter rail stay welded to one set of numbers authored in
 * src/content/panels/*.md.
 */
import { choreography as C } from '../config/choreography';
import { clamp, segment, easeInOut, easeOut, lerp } from './easing';

type FlapName = keyof typeof C.flaps;

interface PanelTiming {
  element: HTMLElement;
  in: number;
  out: number;
}

function must<T extends Element>(selector: string, within: ParentNode = document): T {
  const element = within.querySelector<T>(selector);
  if (!element) throw new Error(`scene.ts: expected to find "${selector}" in the document.`);
  return element;
}

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

  /** Current face edge, read from CSS so JS and the breakpoint never disagree. */
  const edge = (): number =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--S'));

  /**
   * Lays the net out as a cross: a base square, four flaps around it, and the
   * lid hinged off the far edge of the north flap. Transform origins are the
   * hinge lines, which is what lets a single rotation fold each flap up.
   */
  function layoutNet(): void {
    const s = edge();
    const half = s / 2;

    const place = (id: string, left: number, top: number, origin?: string): void => {
      const element = must<HTMLElement>(`#${id}`);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      if (origin) element.style.transformOrigin = origin;
    };

    place('f-base', -half, -half);
    place('f-north', -half, -half - s, '50% 100%');
    place('f-south', -half, half, '50% 0%');
    place('f-west', -half - s, -half, '100% 50%');
    place('f-east', half, -half, '0% 50%');

    const lid = must<HTMLElement>('#f-lid');
    lid.style.left = '0px';
    lid.style.top = `${-s}px`;
    lid.style.transformOrigin = '50% 100%';
  }

  /** Grid position of each net cell: base, north, south, west, east, lid. */
  const cells: Array<[number, number]> = [
    [0, 0],
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -2],
  ];

  /** One mini cube per cell, six faces each. */
  const minis = cells.map(() => {
    const cube = document.createElement('div');
    cube.className = 'mini';
    for (let i = 0; i < 6; i += 1) cube.appendChild(document.createElement('div'));
    net.appendChild(cube);
    return cube;
  });

  const MINI_FACE_ROTATIONS = [
    'rotateY(0deg)',
    'rotateY(90deg)',
    'rotateY(180deg)',
    'rotateY(-90deg)',
    'rotateX(90deg)',
    'rotateX(-90deg)',
  ];

  function layoutMinis(): void {
    const s = edge();
    const size = s * 0.34;
    const halfSize = size / 2;

    minis.forEach((cube, index) => {
      const [column, row] = cells[index]!;
      cube.style.left = `${column * s - halfSize}px`;
      cube.style.top = `${row * s - halfSize}px`;
      [...cube.children].forEach((face, faceIndex) => {
        (face as HTMLElement).style.transform =
          `${MINI_FACE_ROTATIONS[faceIndex]} translateZ(${halfSize}px)`;
      });
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

  layoutNet();
  layoutMinis();
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

    /* camera: tumble in → tilt back as the net opens → face the viewer */
    const { orbit: O } = C;
    const settle = easeInOut(segment(p, ...O.settle));
    const unfold = easeInOut(segment(p, ...O.unfold));
    const flatten = easeInOut(segment(p, ...O.flatten));
    const final = easeInOut(segment(p, ...O.final));

    const drift = reducedMotion ? 0 : t * O.driftRate;
    const yaw = lerp(O.yaw.from + drift * O.yaw.driftFactor, O.yaw.to, settle);

    let tilt = lerp(O.tilt.start, O.tilt.unfolded, unfold);
    tilt = lerp(tilt, O.tilt.flattened, flatten);
    tilt = lerp(tilt, O.tilt.final, final);

    const roll =
      lerp(0, O.roll.onUnfold, unfold) +
      (reducedMotion ? 0 : t * O.roll.spinRate * final) +
      lerp(0, O.roll.onFinal, final);

    const scale = lerp(1, O.scale.onUnfold, unfold) * lerp(1, O.scale.onFinal, final);
    const lift = lerp(0, O.liftPx, easeOut(segment(p, ...O.lift)));

    orbit.style.transform =
      `translateY(${lift.toFixed(1)}px) scale(${scale.toFixed(3)}) ` +
      `rotateX(${tilt.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg) rotateZ(${roll.toFixed(2)}deg)`;

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

    /* mini cubes bloom out of each cell, staggered */
    const { minis: M } = C;
    minis.forEach((cube, index) => {
      const offset = index * M.stagger;
      const bloom = easeOut(segment(p, M.bloom[0] + offset, M.bloom[1] + offset));
      const opacity = bloom * (1 - M.fadeAmount * segment(p, ...M.fadeOut));
      const size = lerp(M.scale.from, M.scale.to, bloom);
      const spin = reducedMotion ? 0 : t * M.spinRate + index * M.spinOffset;

      cube.style.opacity = opacity.toFixed(3);
      cube.style.transform =
        `scale(${size.toFixed(3)}) rotateX(${(spin * 0.6).toFixed(1)}deg) rotateY(${spin.toFixed(1)}deg)`;
    });

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
    layoutNet();
    layoutMinis();
    readScroll();
  });

  readScroll();
  current = target;
  requestAnimationFrame(frame);
}
