import type { PersonaConfig, PersonaId } from "@t3tools/contracts";
import { resolvePersonaPermissions } from "@t3tools/shared/composerContextReferences";

import type { ComposerCommandItem } from "./ComposerCommandMenu";

/** `@` matches for bots: names starting with the query first, then names containing it. */
export function matchComposerPersonaItems(input: {
  personas: Readonly<Record<string, PersonaConfig>>;
  query: string;
}): Extract<ComposerCommandItem, { type: "persona" }>[] {
  const query = input.query.trim().toLowerCase();
  return Object.entries(input.personas)
    .flatMap(([id, persona]) => {
      const name = persona.name.toLowerCase();
      const rank = query === "" || name.startsWith(query) ? 0 : name.includes(query) ? 1 : null;
      return rank === null ? [] : [{ id: id as PersonaId, persona, rank }];
    })
    .toSorted(
      (left, right) =>
        left.rank - right.rank || left.persona.name.localeCompare(right.persona.name),
    )
    .map(({ id, persona }) => ({
      id: `persona:${id}`,
      type: "persona" as const,
      personaId: id,
      persona,
      permissions: resolvePersonaPermissions(id, persona, input.personas),
      label: persona.name,
      description: `Bot · ${persona.modelSelection.model}`,
    }));
}
