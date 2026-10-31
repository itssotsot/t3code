/**
 * Draws a persona's face on a lit 3D body from its seed, in a 100×100 box; one seed, one face.
 * Gradients are `userSpaceOnUse` in that box, and renderers prefix their ids per face.
 * Colors are `hsl()` because react-native-svg has no oklch.
 */

export const PERSONA_FACE_BODIES = [
  "sphere",
  "cube",
  "pyramid",
  "cushion",
  "capsule",
  "tablet",
  "hexagon",
] as const;
export type PersonaFaceBody = (typeof PERSONA_FACE_BODIES)[number];

export type PersonaFacePaint = string | { readonly gradient: string };

export type PersonaFaceGradient = {
  readonly id: string;
  readonly stops: ReadonlyArray<{
    readonly offset: number;
    readonly color: string;
    readonly opacity?: number;
  }>;
} & (
  | {
      readonly kind: "linear";
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    }
  | {
      readonly kind: "radial";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly fx: number;
      readonly fy: number;
    }
);

/**
 * Where a shape belongs, so renderers can move parts: the figure (body, eyes, features) hops while
 * its ground shadow stays put, and the eyes blink on their own.
 */
export type PersonaFaceLayer = "ground" | "body" | "eyes" | "features";

/** Shapes paint back to front; `id` is unique within a face, so renderers can key by it. */
export type PersonaFaceShape = {
  readonly id: string;
  readonly layer: PersonaFaceLayer;
  readonly opacity?: number;
} & (
  | {
      readonly kind: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
      readonly fill: PersonaFacePaint;
    }
  | {
      readonly kind: "ellipse";
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
      readonly fill: PersonaFacePaint;
    }
  | {
      readonly kind: "path";
      readonly d: string;
      readonly fill: PersonaFacePaint | null;
      readonly stroke: PersonaFacePaint | null;
      readonly strokeWidth?: number;
    }
);

export interface PersonaFace {
  readonly body: PersonaFaceBody;
  readonly gradients: ReadonlyArray<PersonaFaceGradient>;
  readonly shapes: ReadonlyArray<PersonaFaceShape>;
}

/** Resolves a paint to an SVG fill or stroke value, given the renderer's gradient id prefix. */
export function personaFacePaint(paint: PersonaFacePaint | null, idPrefix: string): string {
  if (paint === null) return "none";
  return typeof paint === "string" ? paint : `url(#${idPrefix}-${paint.gradient})`;
}

/** What an agent is doing; each state has its own expression on the same face. */
export type PersonaFaceState = "idle" | "working" | "waiting" | "done" | "failed";

/** Maps a task or run status to the face that shows it. */
export function personaFaceStateForStatus(status: string | null | undefined): PersonaFaceState {
  switch (status) {
    case "running":
    case "in_progress":
    case "pending":
    case "queued":
    case "starting":
    case "preparing":
      return "working";
    case "waiting":
      return "waiting";
    case "completed":
      return "done";
    case "failed":
    case "error":
      return "failed";
    default:
      return "idle";
  }
}

// Eyes stay open so no bot looks asleep; a wink shuts one, which reads as playful.
const EYE_KINDS = ["round", "dot", "oval", "wink"] as const;
const MOUTH_KINDS = ["smile", "grin", "open", "flat", "smirk", "cat"] as const;
const BROW_KINDS = ["raised", "focused", "worried"] as const;

// FNV-1a, then mulberry32: small, fast, and identical on every JS engine.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

type Point = readonly [number, number];

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const [l, t, rt, b] = [round(x), round(y), round(x + w), round(y + h)];
  return [
    `M ${round(x + r)} ${t}`,
    `H ${round(x + w - r)}`,
    `A ${r} ${r} 0 0 1 ${rt} ${round(y + r)}`,
    `V ${round(y + h - r)}`,
    `A ${r} ${r} 0 0 1 ${round(x + w - r)} ${b}`,
    `H ${round(x + r)}`,
    `A ${r} ${r} 0 0 1 ${l} ${round(y + h - r)}`,
    `V ${round(y + r)}`,
    `A ${r} ${r} 0 0 1 ${round(x + r)} ${t}`,
    "Z",
  ].join(" ");
}

/** A polygon whose corners are softened by `radius`, shifted down by `dy`. */
function roundedPolygon(points: ReadonlyArray<Point>, radius: number, dy = 0): string {
  const parts: string[] = [];
  points.forEach((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length] ?? current;
    const next = points[(index + 1) % points.length] ?? current;
    const toward = (target: Point) => {
      const dx = target[0] - current[0];
      const dyEdge = target[1] - current[1];
      const length = Math.hypot(dx, dyEdge);
      const r = Math.min(radius, length / 2);
      return [
        round(current[0] + (dx / length) * r),
        round(current[1] + dy + (dyEdge / length) * r),
      ];
    };
    const [ax, ay] = toward(previous);
    const [bx, by] = toward(next);
    parts.push(
      `${index === 0 ? "M" : "L"} ${ax} ${ay} Q ${round(current[0])} ${round(current[1] + dy)} ${bx} ${by}`,
    );
  });
  return `${parts.join(" ")} Z`;
}

/** Where the face sits on a body, how large it is, and whether cheeks still fit. */
interface FaceAnchor {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly cheeks: boolean;
}

export function personaFace(seed: string, state: PersonaFaceState = "idle"): PersonaFace {
  const random = createRandom(seed);
  const between = (min: number, max: number) => min + random() * (max - min);
  const pick = <const T extends readonly [unknown, ...unknown[]]>(values: T): T[number] =>
    values[Math.floor(random() * values.length)] ?? values[0];

  const body = pick(PERSONA_FACE_BODIES);
  const hue = Math.floor(between(0, 360));
  const saturation = Math.round(between(58, 80));
  const lightness = Math.round(between(55, 65));
  const color = (shift: number, light: number) =>
    `hsl(${(hue + shift + 360) % 360} ${saturation}% ${Math.max(8, Math.min(92, light))}%)`;
  const light = color(-6, lightness + 20);
  const base = color(0, lightness);
  const shade = color(14, lightness - 18);
  const deep = color(20, lightness - 30);
  const ink = `hsl(${hue} 45% 13%)`;
  const white = "hsl(0 0% 100%)";

  const gradients: PersonaFaceGradient[] = [];
  const shapes: PersonaFaceShape[] = [];
  const shine = (x: number, y: number, rx: number, ry: number) => {
    gradients.push({
      id: "shine",
      kind: "radial",
      cx: x,
      cy: y,
      r: Math.max(rx, ry),
      fx: x,
      fy: y,
      stops: [
        { offset: 0, color: white, opacity: 0.75 },
        { offset: 1, color: white, opacity: 0 },
      ],
    });
    shapes.push({
      layer: "body",
      id: "shine",
      kind: "ellipse",
      cx: x,
      cy: y,
      rx,
      ry,
      fill: { gradient: "shine" },
    });
  };
  const litFront = (x: number, y: number, r: number) =>
    gradients.push({
      id: "front",
      kind: "radial",
      cx: x,
      cy: y,
      r,
      fx: x,
      fy: y,
      stops: [
        { offset: 0, color: light },
        { offset: 0.5, color: base },
        { offset: 1, color: shade },
      ],
    });
  const sideBand = (top: number, bottom: number) =>
    gradients.push({
      id: "side",
      kind: "linear",
      x1: 0,
      y1: top,
      x2: 0,
      y2: bottom,
      stops: [
        { offset: 0, color: shade },
        { offset: 1, color: deep },
      ],
    });
  // A thick token: the outline again, lower and darker, then the lit front on top.
  const extruded = (outline: (dy: number) => string, top: number, bottom: number) => {
    sideBand(top, bottom + 7);
    shapes.push({
      layer: "body",
      id: "side",
      kind: "path",
      d: outline(7),
      fill: { gradient: "side" },
      stroke: null,
    });
    shapes.push({
      layer: "body",
      id: "front",
      kind: "path",
      d: outline(0),
      fill: { gradient: "front" },
      stroke: null,
    });
  };
  const groundShadow = (rx: number) =>
    shapes.push({
      layer: "ground",
      id: "ground",
      kind: "ellipse",
      cx: 50,
      cy: 93.5,
      rx,
      ry: 3.5,
      fill: "hsl(0 0% 0%)",
      opacity: 0.2,
    });

  let anchor: FaceAnchor;
  switch (body) {
    case "sphere": {
      groundShadow(26);
      litFront(37, 30, 58);
      shapes.push({
        layer: "body",
        id: "front",
        kind: "circle",
        cx: 50,
        cy: 46,
        r: 40,
        fill: { gradient: "front" },
      });
      shine(36, 27, 11, 7);
      anchor = { x: 50, y: 49, scale: 1, cheeks: true };
      break;
    }
    case "cushion": {
      groundShadow(30);
      litFront(38, 28, 72);
      extruded((dy) => roundedRect(12, 10 + dy, 76, 72, 22), 10, 82);
      shine(31, 24, 10, 6);
      anchor = { x: 50, y: 47, scale: 1, cheeks: true };
      break;
    }
    case "capsule": {
      groundShadow(34);
      litFront(36, 32, 70);
      extruded((dy) => roundedRect(6, 20 + dy, 88, 54, 27), 20, 74);
      shine(28, 31, 9, 5);
      anchor = { x: 50, y: 48, scale: 0.92, cheeks: true };
      break;
    }
    case "tablet": {
      groundShadow(22);
      litFront(40, 22, 70);
      extruded((dy) => roundedRect(22, 6 + dy, 56, 78, 16), 6, 84);
      shine(35, 17, 7, 5);
      anchor = { x: 50, y: 44, scale: 0.82, cheeks: false };
      break;
    }
    case "hexagon": {
      groundShadow(30);
      litFront(38, 26, 66);
      const points: ReadonlyArray<Point> = [
        [92, 46],
        [71, 9.6],
        [29, 9.6],
        [8, 46],
        [29, 82.4],
        [71, 82.4],
      ];
      extruded((dy) => roundedPolygon(points, 9, dy), 9.6, 82.4);
      shine(33, 22, 9, 5);
      anchor = { x: 50, y: 48, scale: 0.92, cheeks: true };
      break;
    }
    case "pyramid": {
      groundShadow(32);
      litFront(42, 34, 70);
      const points: ReadonlyArray<Point> = [
        [50, 7],
        [93, 82],
        [7, 82],
      ];
      extruded((dy) => roundedPolygon(points, 11, dy), 7, 82);
      shine(43, 33, 5, 4);
      anchor = { x: 50, y: 61, scale: 0.78, cheeks: false };
      break;
    }
    case "cube": {
      groundShadow(36);
      const facet = (id: string, d: string, from: string, to: string, edge: readonly number[]) => {
        const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = edge;
        gradients.push({
          id,
          kind: "linear",
          x1,
          y1,
          x2,
          y2,
          stops: [
            { offset: 0, color: from },
            { offset: 1, color: to },
          ],
        });
        // A stroke in the facet's own paint closes hairline gaps between facets.
        shapes.push({
          layer: "body",
          id,
          kind: "path",
          d,
          fill: { gradient: id },
          stroke: { gradient: id },
          strokeWidth: 2,
        });
      };
      facet("top", "M 12 32 L 30 14 L 86 14 L 68 32 Z", light, base, [20, 14, 80, 32]);
      facet("cube-side", "M 68 32 L 86 14 L 86 70 L 68 88 Z", shade, deep, [68, 20, 86, 88]);
      facet("front", "M 12 32 L 68 32 L 68 88 L 12 88 Z", base, shade, [12, 32, 68, 88]);
      shapes.push({
        layer: "body",
        id: "edge",
        kind: "path",
        d: "M 12 32 L 68 32 L 86 14",
        fill: null,
        stroke: white,
        strokeWidth: 1.5,
        opacity: 0.4,
      });
      shine(22, 41, 6, 4);
      anchor = { x: 40, y: 61, scale: 0.78, cheeks: false };
      break;
    }
  }

  // Draw every random value before the state changes anything, so an agent keeps its look.
  const s = anchor.scale;
  const seedLookX = between(-1, 1);
  const seedLookY = between(-0.8, 0.6);
  const eyeSpacing = between(12, 15.5) * s;
  const seedEye = pick(EYE_KINDS);
  const seedMouth = pick(MOUTH_KINDS);
  const seedBrow = random() < 0.4 ? pick(BROW_KINDS) : null;
  const cheeks = anchor.cheeks && random() < 0.5;
  const mouthGap = between(14, 17) * s;
  const width = between(13, 19) * s;

  const openEye = (kind: (typeof EYE_KINDS)[number]) => (kind === "wink" ? "dot" : kind);
  const mood: {
    readonly eye: (typeof EYE_KINDS)[number];
    readonly mouth: (typeof MOUTH_KINDS)[number] | "frown";
    readonly brow: (typeof BROW_KINDS)[number] | null;
    readonly lookX: number;
    readonly lookY: number;
  } =
    state === "working"
      ? { eye: openEye(seedEye), mouth: "flat", brow: "focused", lookX: seedLookX, lookY: 0.7 }
      : state === "waiting"
        ? { eye: "round", mouth: "open", brow: "raised", lookX: 0, lookY: -0.8 }
        : state === "done"
          ? {
              eye: openEye(seedEye),
              mouth: "grin",
              brow: "raised",
              lookX: seedLookX,
              lookY: seedLookY,
            }
          : state === "failed"
            ? {
                eye: openEye(seedEye),
                mouth: "frown",
                brow: "worried",
                lookX: seedLookX,
                lookY: 0.4,
              }
            : {
                eye: seedEye,
                mouth: seedMouth,
                brow: seedBrow,
                lookX: seedLookX,
                lookY: seedLookY,
              };

  // The face looks slightly aside; pupils follow a little further than the face.
  const { lookX, lookY } = mood;
  const centerX = anchor.x + lookX * 4 * s;
  const eyeY = anchor.y - 4 * s + lookY * 2 * s;
  const stroke = 4.2 * s;
  const arc = (layer: PersonaFaceLayer, id: string, d: string) =>
    shapes.push({ layer, id, kind: "path", d, fill: null, stroke: ink, strokeWidth: stroke });

  for (const side of [-1, 1] as const) {
    const name = side === -1 ? "left" : "right";
    const x = round(centerX + side * eyeSpacing);
    const y = round(eyeY);
    const pupilX = round(x + lookX * 2.4 * s);
    const pupilY = round(y + lookY * 2.4 * s);
    const catchlight = (r: number) =>
      shapes.push({
        layer: "eyes",
        id: `catchlight-${name}`,
        kind: "circle",
        cx: round(pupilX - 1.6 * s),
        cy: round(pupilY - 1.7 * s),
        r: round(r * s),
        fill: white,
      });
    const kind = mood.eye === "wink" ? (side === -1 ? "dot" : "winked") : mood.eye;
    switch (kind) {
      case "round":
        shapes.push({
          layer: "eyes",
          id: `sclera-${name}`,
          kind: "ellipse",
          cx: x,
          cy: y,
          rx: round(7.5 * s),
          ry: round(8.5 * s),
          fill: white,
        });
        shapes.push({
          layer: "eyes",
          id: `pupil-${name}`,
          kind: "circle",
          cx: pupilX,
          cy: pupilY,
          r: round(4.6 * s),
          fill: ink,
        });
        catchlight(1.6);
        break;
      case "dot":
        shapes.push({
          layer: "eyes",
          id: `pupil-${name}`,
          kind: "circle",
          cx: pupilX,
          cy: pupilY,
          r: round(5.6 * s),
          fill: ink,
        });
        catchlight(1.8);
        break;
      case "oval":
        shapes.push({
          layer: "eyes",
          id: `pupil-${name}`,
          kind: "ellipse",
          cx: pupilX,
          cy: pupilY,
          rx: round(4.2 * s),
          ry: round(7 * s),
          fill: ink,
        });
        catchlight(1.5);
        break;
      case "winked":
        arc(
          "eyes",
          `eye-${name}`,
          `M ${round(x - 6 * s)} ${round(y + 2 * s)} Q ${x} ${round(y - 6 * s)} ${round(x + 6 * s)} ${round(y + 2 * s)}`,
        );
        break;
    }
    if (mood.brow !== null) {
      // Inner and outer brow heights; the inner end is the one toward the middle of the face.
      const [inner, outer] =
        mood.brow === "raised" ? [-1.5, -1.5] : mood.brow === "focused" ? [2.5, -1.5] : [-2.5, 1];
      const innerX = x - side * 6 * s;
      const outerX = x + side * 6 * s;
      const browY = y - 12 * s;
      arc(
        "features",
        `brow-${name}`,
        `M ${round(innerX)} ${round(browY + inner * s)} Q ${x} ${round(browY - 2.5 * s)} ${round(outerX)} ${round(browY + outer * s)}`,
      );
    }
    if (cheeks) {
      shapes.push({
        layer: "features",
        id: `cheek-${name}`,
        kind: "ellipse",
        cx: round(centerX + side * (eyeSpacing + 5 * s)),
        cy: round(eyeY + 10 * s),
        rx: round(5.5 * s),
        ry: round(3.2 * s),
        fill: "hsl(350 85% 70%)",
        opacity: 0.55,
      });
    }
  }

  const mouthY = eyeY + mouthGap;
  const left = round(centerX - width / 2);
  const right = round(centerX + width / 2);
  const center = round(centerX);
  const top = round(mouthY);
  switch (mood.mouth) {
    case "smile":
      arc(
        "features",
        "mouth",
        `M ${left} ${top} Q ${center} ${round(mouthY + 8 * s)} ${right} ${top}`,
      );
      break;
    case "frown":
      arc(
        "features",
        "mouth",
        `M ${left} ${round(mouthY + 5 * s)} Q ${center} ${round(mouthY - 3 * s)} ${right} ${round(mouthY + 5 * s)}`,
      );
      break;
    case "grin":
      shapes.push({
        layer: "features",
        id: "mouth",
        kind: "path",
        d: `M ${left} ${top} Q ${center} ${round(mouthY + 15 * s)} ${right} ${top} Z`,
        fill: ink,
        stroke: ink,
        strokeWidth: round(1.5 * s),
      });
      shapes.push({
        layer: "features",
        id: "tongue",
        kind: "ellipse",
        cx: center,
        cy: round(mouthY + 4.6 * s),
        rx: round(width * 0.2),
        ry: round(2.2 * s),
        fill: "hsl(352 80% 66%)",
      });
      break;
    case "open":
      shapes.push({
        layer: "features",
        id: "mouth",
        kind: "ellipse",
        cx: center,
        cy: round(mouthY + 2.5 * s),
        rx: round(4.4 * s),
        ry: round(5.4 * s),
        fill: ink,
      });
      break;
    case "flat":
      arc(
        "features",
        "mouth",
        `M ${round(centerX - width / 3)} ${round(mouthY + 2 * s)} L ${round(centerX + width / 3)} ${round(mouthY + 2 * s)}`,
      );
      break;
    case "smirk":
      arc(
        "features",
        "mouth",
        `M ${left} ${round(mouthY + 2 * s)} Q ${round(centerX + width / 4)} ${round(mouthY + 5 * s)} ${right} ${round(mouthY - 2 * s)}`,
      );
      break;
    case "cat":
      arc(
        "features",
        "mouth",
        `M ${left} ${top} Q ${round(centerX - width / 4)} ${round(mouthY + 6 * s)} ${center} ${top} Q ${round(centerX + width / 4)} ${round(mouthY + 6 * s)} ${right} ${top}`,
      );
      break;
  }

  return { body, gradients, shapes };
}
