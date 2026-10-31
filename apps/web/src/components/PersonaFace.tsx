import {
  personaFace,
  personaFacePaint,
  type PersonaFaceShape,
  type PersonaFaceState,
} from "@t3tools/shared/personaFace";
import { memo, useEffect, useId, useRef } from "react";

// One-shot motions played when a face changes state. Nothing loops: AGENTS.md forbids
// continuously repainting animations.
const STATE_MOTIONS: Partial<
  Record<PersonaFaceState, { readonly keyframes: Keyframe[]; readonly duration: number }>
> = {
  working: {
    keyframes: [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-8deg)" },
      { transform: "rotate(2deg)" },
      { transform: "rotate(0deg)" },
    ],
    duration: 420,
  },
  waiting: {
    keyframes: [
      { transform: "rotate(0deg)" },
      { transform: "rotate(10deg)" },
      { transform: "rotate(-3deg)" },
      { transform: "rotate(0deg)" },
    ],
    duration: 560,
  },
  done: {
    keyframes: [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(0) scale(1.06, 0.9)", offset: 0.2 },
      { transform: "translateY(-14px) scale(0.96, 1.06)", offset: 0.5 },
      { transform: "translateY(0) scale(1.04, 0.94)", offset: 0.8 },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    duration: 520,
  },
  failed: {
    keyframes: [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" },
    ],
    duration: 420,
  },
};
const BLINK: Keyframe[] = [
  { transform: "scaleY(1)" },
  { transform: "scaleY(0.1)" },
  { transform: "scaleY(1)" },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A persona's generated face on its 3D body; size it with `className`. Its expression follows
 * `state`, a change of state plays one short motion, and hovering it blinks.
 */
export const PersonaFace = memo(function PersonaFace(props: {
  seed: string;
  state?: PersonaFaceState;
  className?: string;
}) {
  const state = props.state ?? "idle";
  const face = personaFace(props.seed, state);
  // Gradient ids are document-global, so each face prefixes its own.
  const prefix = `persona-face-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const figureRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const shownState = useRef(state);
  // Animates only a change seen while mounted, so rows scrolling into view stay still.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- plays a one-shot Web Animation on the SVG node when the agent's state changes
  useEffect(() => {
    if (shownState.current === state) return;
    shownState.current = state;
    const motion = STATE_MOTIONS[state];
    if (motion === undefined || prefersReducedMotion()) return;
    figureRef.current?.animate(motion.keyframes, {
      duration: motion.duration,
      easing: "ease-out",
    });
  }, [state]);
  const blink = () => {
    if (prefersReducedMotion()) return;
    eyesRef.current?.animate(BLINK, { duration: 160, easing: "ease-in-out" });
  };
  const renderShapes = (layer: PersonaFaceShape["layer"]) =>
    face.shapes.filter((shape) => shape.layer === layer).map((shape) => renderShape(shape, prefix));
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={props.className}
      onPointerEnter={blink}
    >
      <defs>
        {face.gradients.map((gradient) => {
          const stops = gradient.stops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity ?? 1}
            />
          ));
          return gradient.kind === "linear" ? (
            <linearGradient
              key={gradient.id}
              id={`${prefix}-${gradient.id}`}
              gradientUnits="userSpaceOnUse"
              x1={gradient.x1}
              y1={gradient.y1}
              x2={gradient.x2}
              y2={gradient.y2}
            >
              {stops}
            </linearGradient>
          ) : (
            <radialGradient
              key={gradient.id}
              id={`${prefix}-${gradient.id}`}
              gradientUnits="userSpaceOnUse"
              cx={gradient.cx}
              cy={gradient.cy}
              r={gradient.r}
              fx={gradient.fx}
              fy={gradient.fy}
            >
              {stops}
            </radialGradient>
          );
        })}
      </defs>
      {renderShapes("ground")}
      <g ref={figureRef} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        {renderShapes("body")}
        <g ref={eyesRef} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          {renderShapes("eyes")}
        </g>
        {renderShapes("features")}
      </g>
    </svg>
  );
});

function renderShape(shape: PersonaFaceShape, prefix: string) {
  switch (shape.kind) {
    case "circle":
      return (
        <circle
          key={shape.id}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={personaFacePaint(shape.fill, prefix)}
          opacity={shape.opacity}
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={shape.id}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={personaFacePaint(shape.fill, prefix)}
          opacity={shape.opacity}
        />
      );
    case "path":
      return (
        <path
          key={shape.id}
          d={shape.d}
          fill={personaFacePaint(shape.fill, prefix)}
          stroke={personaFacePaint(shape.stroke, prefix)}
          strokeWidth={shape.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={shape.opacity}
        />
      );
  }
}
