import { PersonaId, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { matchComposerPersonaItems } from "./composerPersonaItems";

const persona = (name: string) => ({
  name,
  responsibilities: "",
  modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.5" },
  faceSeed: name,
  canEditCode: true,
  delegatesTo: [],
});

const personas = {
  [PersonaId.make("reviewer")]: persona("Reviewer"),
  [PersonaId.make("planner")]: persona("Planner"),
  [PersonaId.make("previewer")]: persona("Previewer"),
};

describe("matchComposerPersonaItems", () => {
  it("lists every agent by name for an empty query", () => {
    expect(matchComposerPersonaItems({ personas, query: "" }).map((item) => item.label)).toEqual([
      "Planner",
      "Previewer",
      "Reviewer",
    ]);
  });

  it("ranks names starting with the query before names containing it", () => {
    expect(matchComposerPersonaItems({ personas, query: "rev" }).map((item) => item.label)).toEqual(
      ["Reviewer", "Previewer"],
    );
  });

  it("drops agents that do not match", () => {
    expect(matchComposerPersonaItems({ personas, query: "zzz" })).toEqual([]);
  });
});
