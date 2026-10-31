import { personaFace, personaFacePaint, type PersonaFaceState } from "@t3tools/shared/personaFace";
import { memo, useEffect, useId, useRef } from "react";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

/** Steps of a one-shot motion: each value is reached over `duration` ms, in order. */
function sequence(values: ReadonlyArray<number>, duration: number) {
  const step = { duration: duration / values.length, reduceMotion: ReduceMotion.System };
  const [first = 0, ...rest] = values;
  return withSequence(withTiming(first, step), ...rest.map((value) => withTiming(value, step)));
}

/**
 * A persona's generated face on its 3D body, drawn from the same seed as on web. Its expression
 * follows `state`, and a change of state plays one short motion; nothing loops.
 */
export const PersonaFace = memo(function PersonaFace(props: {
  readonly seed: string;
  readonly size: number;
  readonly state?: PersonaFaceState;
}) {
  const state = props.state ?? "idle";
  const face = personaFace(props.seed, state);
  const prefix = `persona-face-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Motions are in the face's 100-unit box; the view moves in points.
  const unit = props.size / 100;
  const rotate = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const stretch = useSharedValue(1);
  const shownState = useRef(state);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts a one-shot native animation when the agent's state changes while mounted
  useEffect(() => {
    if (shownState.current === state) return;
    shownState.current = state;
    switch (state) {
      case "working":
        rotate.set(sequence([-8, 2, 0], 420));
        break;
      case "waiting":
        rotate.set(sequence([10, -3, 0], 560));
        break;
      case "done":
        shiftY.set(sequence([0, -14 * unit, 0], 520));
        stretch.set(sequence([0.9, 1.06, 0.95, 1], 520));
        break;
      case "failed":
        shiftX.set(sequence([-6 * unit, 6 * unit, -4 * unit, 4 * unit, 0], 420));
        break;
      case "idle":
        break;
    }
  }, [state, unit, rotate, shiftX, shiftY, stretch]);
  const motionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shiftX.get() },
      { translateY: shiftY.get() },
      { rotate: `${rotate.get()}deg` },
      { scaleY: stretch.get() },
      { scaleX: 2 - stretch.get() },
    ],
  }));
  return (
    <Animated.View style={[{ width: props.size, height: props.size }, motionStyle]}>
      <Svg width={props.size} height={props.size} viewBox="0 0 100 100" accessible={false}>
        <Defs>
          {face.gradients.map((gradient) => {
            const stops = gradient.stops.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity ?? 1}
              />
            ));
            return gradient.kind === "linear" ? (
              <LinearGradient
                key={gradient.id}
                id={`${prefix}-${gradient.id}`}
                gradientUnits="userSpaceOnUse"
                x1={gradient.x1}
                y1={gradient.y1}
                x2={gradient.x2}
                y2={gradient.y2}
              >
                {stops}
              </LinearGradient>
            ) : (
              <RadialGradient
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
              </RadialGradient>
            );
          })}
        </Defs>
        {face.shapes.map((shape) => {
          switch (shape.kind) {
            case "circle":
              return (
                <Circle
                  key={shape.id}
                  cx={shape.cx}
                  cy={shape.cy}
                  r={shape.r}
                  fill={personaFacePaint(shape.fill, prefix)}
                  opacity={shape.opacity ?? 1}
                />
              );
            case "ellipse":
              return (
                <Ellipse
                  key={shape.id}
                  cx={shape.cx}
                  cy={shape.cy}
                  rx={shape.rx}
                  ry={shape.ry}
                  fill={personaFacePaint(shape.fill, prefix)}
                  opacity={shape.opacity ?? 1}
                />
              );
            case "path":
              return (
                <Path
                  key={shape.id}
                  d={shape.d}
                  fill={personaFacePaint(shape.fill, prefix)}
                  stroke={personaFacePaint(shape.stroke, prefix)}
                  strokeWidth={shape.strokeWidth ?? 0}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={shape.opacity ?? 1}
                />
              );
          }
        })}
      </Svg>
    </Animated.View>
  );
});
