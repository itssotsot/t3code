import { describe, expect, it } from "vite-plus/test";

import {
  PERSONA_FACE_BODIES,
  type PersonaFaceState,
  personaFace,
  personaFaceStateForStatus,
} from "./personaFace.ts";

const STATES: ReadonlyArray<PersonaFaceState> = ["idle", "working", "waiting", "done", "failed"];
const faces = Array.from({ length: 300 }, (_, index) => personaFace(`seed-${index}`));
const facesInEveryState = Array.from({ length: 60 }, (_, index) =>
  STATES.map((state) => personaFace(`seed-${index}`, state)),
).flat();

describe("personaFace", () => {
  it("draws the same face for the same seed", () => {
    expect(personaFace("reviewer-seed")).toEqual(personaFace("reviewer-seed"));
  });

  it("draws every body and varied faces across seeds", () => {
    expect(new Set(faces.map((face) => face.body))).toEqual(new Set(PERSONA_FACE_BODIES));
    expect(new Set(faces.map((face) => JSON.stringify(face.shapes))).size).toBe(faces.length);
  });

  it("keeps every shape inside the box and gives each a unique key", () => {
    for (const face of [...faces, ...facesInEveryState]) {
      const ids = face.shapes.map((shape) => shape.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const shape of face.shapes) {
        if (shape.kind === "path") continue;
        const rx = shape.kind === "circle" ? shape.r : shape.rx;
        const ry = shape.kind === "circle" ? shape.r : shape.ry;
        expect(shape.cx - rx).toBeGreaterThanOrEqual(0);
        expect(shape.cx + rx).toBeLessThanOrEqual(100);
        expect(shape.cy - ry).toBeGreaterThanOrEqual(0);
        expect(shape.cy + ry).toBeLessThanOrEqual(100);
      }
    }
  });

  it("only paints with gradients the face defines", () => {
    for (const face of faces) {
      const defined = new Set(face.gradients.map((gradient) => gradient.id));
      for (const shape of face.shapes) {
        const paints = shape.kind === "path" ? [shape.fill, shape.stroke] : [shape.fill];
        for (const paint of paints) {
          if (paint !== null && typeof paint !== "string") {
            expect(defined.has(paint.gradient)).toBe(true);
          }
        }
      }
    }
  });

  it("keeps an agent's body and colors in every state and changes only its expression", () => {
    for (let index = 0; index < 60; index += 1) {
      const [idle, ...others] = STATES.map((state) => personaFace(`seed-${index}`, state));
      const still = (face: typeof idle) =>
        face?.shapes.filter((shape) => shape.layer === "ground" || shape.layer === "body");
      for (const face of others) {
        expect(face.body).toBe(idle?.body);
        expect(face.gradients).toEqual(idle?.gradients);
        expect(still(face)).toEqual(still(idle));
      }
      // An agent's natural look may match one state; the active states always differ.
      const active = STATES.filter((state) => state !== "idle");
      const expressions = new Set(
        active.map((state) =>
          JSON.stringify(
            personaFace(`seed-${index}`, state).shapes.filter((shape) => shape.layer !== "body"),
          ),
        ),
      );
      expect(expressions.size).toBe(active.length);
    }
  });

  it("never draws a bot with both eyes shut", () => {
    for (const face of [...faces, ...facesInEveryState]) {
      const pupils = face.shapes.filter((shape) => shape.id.startsWith("pupil-"));
      expect(pupils.length).toBeGreaterThan(0);
    }
  });

  it("shows a task's status as its state", () => {
    expect(personaFaceStateForStatus("running")).toBe("working");
    expect(personaFaceStateForStatus("waiting")).toBe("waiting");
    expect(personaFaceStateForStatus("completed")).toBe("done");
    expect(personaFaceStateForStatus("failed")).toBe("failed");
    expect(personaFaceStateForStatus("cancelled")).toBe("idle");
    expect(personaFaceStateForStatus(null)).toBe("idle");
  });
});
