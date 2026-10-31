import { createFileRoute } from "@tanstack/react-router";

import { PersonaSettingsPanel } from "../components/settings/PersonaSettings";

export const Route = createFileRoute("/_chat/settings/bots")({
  component: PersonaSettingsPanel,
});
