/**
 * Intro timeline — pure math, no React.
 *
 * The animation is a pure function of elapsed milliseconds so it can be sampled
 * at any time (rAF in the browser, or a static renderer for stills).
 *
 * All diner coordinates are in the reference artwork's pixel space (527 × 581).
 * The scene is drawn in that space, then the camera scales/translates it to
 * reveal a wider 1400 × 900 restaurant.
 */

export const INTRO_DURATION = 6400;
export const INTRO_SEEN_KEY = "khang_intro_seen";

export const ART = { w: 527, h: 581 };

/** Measured landmarks of the reference illustration. */
export const GEO = {
  head: { cx: 258.5, cy: 272, r: 62 },
  shoulder: { x: 206, y: 336 },
  elbow: { x: 150.3, y: 394.5 },
  cuff: { x: 272, y: 312 },
  food: { cx: 270, cy: 303 },
  tableTop: 493,
  bowl: { x: 96, top: 442, bottom: 484 },
};

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t;

/** Silky in-and-out for camera moves — used instead of easeInOut for the pull. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 0 before `from`, 1 after `to`, smoothed in between. */
export const smoothstep = (v: number, from: number, to: number) => {
  const t = clamp((v - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** Normalised progress of `ms` through [from, to]. */
export const range = (ms: number, from: number, to: number) =>
  clamp((ms - from) / (to - from));

export const rotatePoint = (p: { x: number; y: number }, o: { x: number; y: number }, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return {
    x: o.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: o.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
};

export interface Pose {
  /** Whole-arm rotation about the elbow, degrees. 0 = the reference pose. */
  arm: number;
  /** Small translation of the arm, artwork units. */
  armX: number;
  armY: number;
  /** Head tilt, degrees. */
  head: number;
  /** Body bob, artwork units. */
  bob: number;
  /** 0 = eyes open, 1 = happy closed arcs. */
  happy: number;
  /** 0…1 mouth open. */
  mouth: number;
  /** 0…1 how visible the bite on the chopsticks is. */
  food: number;
  /** 0…1 noodle strands stretching down to the bowl. */
  strand: number;
}

const K = (
  ms: number,
  arm: number,
  extra: Partial<Pose> = {},
): { ms: number; pose: Pose } => ({
  ms,
  pose: {
    arm,
    armX: 0,
    armY: 0,
    head: 0,
    bob: 0,
    happy: 0,
    mouth: 0,
    food: 1,
    strand: 0,
    ...extra,
  },
});

/**
 * Key poses. The intro opens on the reference illustration, then the diner
 * dips, lifts, eats and settles back — a single readable eating loop.
 */
export const KEYS = [
  // a solid silhouette to open on, then the mouth opens as the bite is taken
  K(0, 0, { food: 0 }),
  K(620, 6, { food: 1, mouth: 0.4 }),

  // lift the chopsticks off the mouth and swing them down to the bowl
  K(1080, 26, { head: 8, food: 0, strand: 0.15, bob: 1 }),
  K(1420, 34, { head: 11, food: 0, strand: 0.3, bob: 2 }),

  // scoop and lift back up
  K(1740, 24, { head: 9, food: 0.2, strand: 0.6, bob: 1 }),
  K(2060, 11, { head: 5, food: 0.7, strand: 0.95 }),
  K(2280, 4, { head: 3, food: 0.95, strand: 1 }),

  // back at the mouth
  K(2460, 0, { food: 1, strand: 0.8, mouth: 0.85 }),
  K(2640, 0, { food: 0.35, strand: 0.5, mouth: 0.55, bob: 1 }),

  // chew
  K(2840, 0, { food: 0, strand: 0.3, mouth: 0.22, bob: 5 }),
  K(3040, 0, { food: 0, strand: 0.16, mouth: 0.5, bob: -2 }),
  K(3240, 0, { food: 0, strand: 0.06, mouth: 0.18, bob: 4 }),
  K(3460, 0, { food: 0, mouth: 0, bob: 0 }),

  // idle while the room and the wordmark arrive
  K(4300, 0, { bob: 2 }),
  K(5400, 0, { bob: 0 }),
  K(6000, 0, { bob: 1.4 }),
  K(INTRO_DURATION, 0, { bob: 0.5 }),
];

export function poseAt(ms: number): Pose {
  if (ms <= KEYS[0].ms) return KEYS[0].pose;
  for (let i = 1; i < KEYS.length; i += 1) {
    const b = KEYS[i];
    if (ms <= b.ms) {
      const a = KEYS[i - 1];
      const t = easeInOut((ms - a.ms) / Math.max(1, b.ms - a.ms));
      const pa = a.pose;
      const pb = b.pose;
      return {
        arm: lerp(pa.arm, pb.arm, t),
        armX: lerp(pa.armX, pb.armX, t),
        armY: lerp(pa.armY, pb.armY, t),
        head: lerp(pa.head, pb.head, t),
        bob: lerp(pa.bob, pb.bob, t),
        happy: lerp(pa.happy, pb.happy, t),
        mouth: lerp(pa.mouth, pb.mouth, t),
        food: lerp(pa.food, pb.food, t),
        strand: lerp(pa.strand, pb.strand, t),
      };
    }
  }
  return KEYS[KEYS.length - 1].pose;
}

/** Where the bite sits — it travels with the arm. */
export function foodAt(pose: Pose) {
  const p = rotatePoint({ x: GEO.food.cx, y: GEO.food.cy }, GEO.elbow, pose.arm);
  return { x: p.x + pose.armX, y: p.y + pose.armY };
}

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

/** Room size in artwork units. Artwork (527 × 581) sits at its left edge. */
export const SCENE = { w: 1000, h: 600, roomX: 527 };

/**
 * Camera. The intro opens tight on the bite and pulls back until the whole
 * diner composition fills the screen, where it holds for the hand-off.
 * Values are in artwork units for the 1000 × 600 scene viewBox.
 */
export function cameraAt(ms: number): Camera {
  // The move is a single continuous gesture with three phases, the way a motion
  // designer would shoot it: a long reveal, a spring settle, then a slow drift
  // that keeps the held frame alive until the hand-off pushes in.
  const reveal = easeInOutCubic(range(ms, 0, 4200));
  const settle = easeOut(range(ms, 4200, 5100));
  const drift = easeInOutCubic(range(ms, 5100, INTRO_DURATION - 700));
  const push = easeInOut(range(ms, INTRO_DURATION - 700, INTRO_DURATION));

  // pull past the resting size, then relax back into it
  let scale = lerp(2.2, 0.94, reveal);
  scale = lerp(scale, 0.955, settle);
  scale = lerp(scale, 0.95, drift);

  // once the frame is held the camera keeps breathing, very slightly
  const idle = smoothstep(ms, 4400, 5600) * (1 - push);
  scale *= 1 + Math.sin((ms - 4400) / 640) * 0.006 * idle;

  // the hand-off pushes in, so the page feels pulled open rather than cut to
  scale *= 1 + 0.05 * push;

  // the reveal arcs down from the chopsticks, the drift creeps in slightly
  const focusX = lerp(292, 262, reveal) - 2.5 * drift;
  const focusY = lerp(318, 362, reveal) + 2 * drift;

  return {
    scale,
    x: SCENE.w / 2 - focusX * scale,
    y: SCENE.h / 2 - focusY * scale,
  };
}

/** The figure is simply there from the first frame — no fade-in. */
export function roomAt() {
  return {
    figureIn: 1,
  };
}

/** 0 = intro visible, 1 = handed over to the homepage. */
export function exitAt(ms: number) {
  return easeInOut(range(ms, INTRO_DURATION - 700, INTRO_DURATION));
}

export interface Motion {
  /** Whole-figure lean, degrees, hinged near the hips. */
  lean: number;
  /** Head turn, degrees. */
  nod: number;
  /** Breathing scale about the hips — 1.0 ± 0.003. */
  breath: number;
  /** 0…1 how much of the drawing is on screen (the ink arrives first). */
  ink: number;
}

export interface IntroFrame {
  ms: number;
  pose: Pose;
  motion: Motion;
  food: { x: number; y: number };
  camera: Camera;
  figureIn: number;
  exit: number;
}

/** The figure's life: breath, lean and nod, all driven off the pose. */
export function motionAt(pose: Pose, ms: number): Motion {
  const bob = pose.bob;
  return {
    lean: -(bob * 0.45 + pose.arm * 0.07),
    nod: pose.head * 0.35,
    breath: 1 + Math.sin(ms / 880) * 0.0032,
    ink: smoothstep(ms, 0, 220),
  };
}

/** Small organic touches layered on the keyframes. */
function garnish(pose: Pose, ms: number): Pose {
  const chew = range(ms, 2400, 2500) * (1 - range(ms, 3200, 3400));
  const wobble = Math.sin((ms - 2400) / 110) * 2.2 * chew;
  const idle = range(ms, 3400, 4200);
  const breathe = Math.sin(ms / 620) * 1.2 * idle;
  return { ...pose, head: pose.head + wobble, bob: pose.bob + breathe };
}

export function frameAt(ms: number): IntroFrame {
  const pose = garnish(poseAt(ms), ms);
  const { figureIn } = roomAt();
  return {
    ms,
    pose,
    motion: motionAt(pose, ms),
    food: foodAt(pose),
    camera: cameraAt(ms),
    figureIn,
    exit: exitAt(ms),
  };
}

/** A blip of "mmm" right after the bite. */
export function sparkleAt(ms: number) {
  const t = range(ms, 3100, 3700);
  return { amount: t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0, t };
}

/** Choreography beats: the meal, then the hand-off to the homepage. */
export function beatAt(ms: number): "eat" | "out" {
  if (ms < INTRO_DURATION - 700) return "eat";
  return "out";
}
