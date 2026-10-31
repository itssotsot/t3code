import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ModelSelection } from "./modelSelection.ts";

/**
 * A persona is a user-named agent: a model and effort plus the responsibilities it is told to
 * own. Mentioning one in the composer runs that turn on its model with its responsibilities as
 * instructions. The UI calls them "bots"; code says persona so it never collides with the
 * coding agent itself.
 */

export const PERSONA_NAME_MAX_CHARS = 64;
export const PERSONA_RESPONSIBILITIES_MAX_CHARS = 4_000;
const PERSONA_FACE_SEED_MAX_CHARS = 64;

export const PersonaId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z0-9_-]+$/),
).pipe(Schema.brand("PersonaId"));
export type PersonaId = typeof PersonaId.Type;

export const PersonaName = TrimmedNonEmptyString.check(Schema.isMaxLength(PERSONA_NAME_MAX_CHARS));
export const PersonaResponsibilities = Schema.String.check(
  Schema.isMaxLength(PERSONA_RESPONSIBILITIES_MAX_CHARS),
);
/** Seeds the persona's generated face; rerolling the face writes a new seed. */
export const PersonaFaceSeed = TrimmedNonEmptyString.check(
  Schema.isMaxLength(PERSONA_FACE_SEED_MAX_CHARS),
);

export const PersonaConfig = Schema.Struct({
  name: PersonaName,
  responsibilities: PersonaResponsibilities,
  modelSelection: ModelSelection,
  faceSeed: PersonaFaceSeed,
  /** False makes the persona read-only: it is told so and runs supervised, so edits need approval. */
  canEditCode: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
  /** The other personas it may hand work to, or all of them, including ones added later. */
  delegatesTo: Schema.Union([Schema.Literal("all"), Schema.Array(PersonaId)]).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
});
export type PersonaConfig = typeof PersonaConfig.Type;

/** The personas `id` may hand work to, in `personas` order; deleted ones drop out. */
export function personaDelegateIds(
  id: PersonaId,
  persona: Pick<PersonaConfig, "delegatesTo">,
  personas: Readonly<Record<PersonaId, unknown>>,
): ReadonlyArray<PersonaId> {
  const existing = Object.keys(personas) as Array<PersonaId>;
  return persona.delegatesTo === "all"
    ? existing.filter((other) => other !== id)
    : existing.filter((other) => other !== id && persona.delegatesTo.includes(other));
}

/**
 * Which agent a delegated child is, shown wherever the subagent appears. A snapshot taken when
 * the task is created, so renaming or deleting the agent leaves past tasks as they were.
 */
export const PersonaIdentity = Schema.Struct({
  personaId: PersonaId,
  name: PersonaName,
  faceSeed: PersonaFaceSeed,
});
export type PersonaIdentity = typeof PersonaIdentity.Type;

/** What a persona may do, as snapshotted onto a message for the provider to read. */
export const PersonaPermissions = Schema.Struct({
  canEditCode: Schema.Boolean,
  delegatesTo: Schema.Array(Schema.Struct({ personaId: PersonaId, name: PersonaName })),
});
export type PersonaPermissions = typeof PersonaPermissions.Type;
