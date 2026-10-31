import { type PersonaConfig, type PersonaId, personaDelegateIds } from "@t3tools/contracts";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import { getCustomModelOptionsByInstance } from "../../modelSelection";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { type EnvironmentPresentation, useEnvironmentProviders } from "../../state/environments";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { useEnvironmentSessionState } from "../../state/session";
import { PersonaFace } from "../PersonaFace";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { PersonaDialog } from "./PersonaDialog";
import { PersonaModelSummary } from "./PersonaModelSummary";
import { PersonaTeamMap } from "./PersonaTeamMap";
import {
  classifyProviderEnvironmentAccess,
  resolveRemoteOperateAccess,
} from "./ProviderSettingsPanel.logic";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

export function PersonaSettingsPanel() {
  const { scope, environment } = useSettingsScope();
  const connected = environment?.connection.phase === "connected";
  return (
    <SettingsPageContainer>
      {connected &&
      environment.serverConfig !== null &&
      environment.serverConfig.environment.capabilities.personas !== true ? (
        <SettingsSection {...searchableSetting("bots")}>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Update T3 Code on {environment.label} to give it bots.
          </p>
        </SettingsSection>
      ) : connected ? (
        <EnvironmentPersonas
          key={environment.environmentId}
          environment={environment}
          projectScoped={scope.kind === "project" || scope.kind === "checkout"}
        />
      ) : (
        <SettingsSection {...searchableSetting("bots")}>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Connect an environment to manage its bots.
          </p>
        </SettingsSection>
      )}
    </SettingsPageContainer>
  );
}

function EnvironmentPersonas({
  environment,
  projectScoped,
}: {
  readonly environment: EnvironmentPresentation;
  readonly projectScoped: boolean;
}) {
  const environmentId = environment.environmentId;
  const sessionState = useEnvironmentSessionState(environmentId);
  const access = classifyProviderEnvironmentAccess({
    connectionPhase: environment.connection.phase,
    hasServerConfig: environment.serverConfig !== null,
    operateAccess: resolveRemoteOperateAccess({
      session: sessionState.data,
      isPending: sessionState.isPending,
      hasError: sessionState.hasError,
    }),
  });
  const readOnly = access.kind !== "editable" || projectScoped;
  const settings = useEnvironmentSettings(environmentId);
  const personas = settings.personas;
  const providers = useEnvironmentProviders().get(environmentId) ?? EMPTY_SERVER_PROVIDERS;
  const instanceEntries = providerInstanceEntriesFor(providers, settings, null);
  const modelOptionsByInstance = getCustomModelOptionsByInstance(settings, providers);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const [dialog, setDialog] = useState<
    null | { readonly mode: "add" } | { readonly mode: "edit"; readonly id: PersonaId }
  >(null);
  const entries = (Object.entries(personas) as Array<[PersonaId, PersonaConfig]>).toSorted(
    ([, left], [, right]) => left.name.localeCompare(right.name),
  );
  const editingConfig = dialog?.mode === "edit" ? personas[dialog.id] : undefined;
  return (
    <>
      <SettingsSection
        {...searchableSetting("bots")}
        headerAction={
          !readOnly ? (
            <Button size="xs" variant="outline" onClick={() => setDialog({ mode: "add" })}>
              <PlusIcon className="size-3" aria-hidden />
              Add bot
            </Button>
          ) : null
        }
      >
        {projectScoped ? (
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Environment-wide setting. Select an environment to change it.
          </p>
        ) : null}
        {entries.length === 0 ? (
          <SettingsRow
            title="No bots yet."
            description="Add a bot with its own model, effort, and responsibilities, then mention it with @ in a chat to hand it the turn."
          />
        ) : (
          entries.map(([id, persona]) => (
            <SettingsRow
              key={id}
              className={
                readOnly
                  ? undefined
                  : "relative transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/50"
              }
              title={
                readOnly ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <PersonaFace seed={persona.faceSeed} className="size-6 shrink-0" />
                    <span className="min-w-0 wrap-anywhere">{persona.name}</span>
                  </span>
                ) : (
                  // The ::after stretches the button over the row, so the whole row opens the bot.
                  <button
                    type="button"
                    aria-label={`Edit ${persona.name}`}
                    onClick={() => setDialog({ mode: "edit", id })}
                    className="flex min-w-0 cursor-pointer items-center gap-2 text-left outline-none after:absolute after:inset-0 after:rounded-xl"
                  >
                    <PersonaFace seed={persona.faceSeed} className="size-6 shrink-0" />
                    <span className="min-w-0 wrap-anywhere">{persona.name}</span>
                  </button>
                )
              }
              description={
                <span className="grid gap-3">
                  {persona.responsibilities.trim() ? (
                    <span className="line-clamp-2">{persona.responsibilities.trim()}</span>
                  ) : null}
                  <PersonaModelSummary
                    modelSelection={persona.modelSelection}
                    instanceEntries={instanceEntries}
                    modelOptionsByInstance={modelOptionsByInstance}
                    planModeEnabled={settings.planModeEnabled}
                  />
                  <span className="truncate">
                    {persona.canEditCode ? "Edits code" : "Read only"}
                    {" · "}
                    {delegateNames(id, persona, personas)}
                  </span>
                </span>
              }
              control={
                !readOnly ? (
                  <div className="relative z-10">
                    <RemovePersonaButton
                      name={persona.name}
                      onConfirm={() => updateSettings({ personas: { [id]: null } })}
                    />
                  </div>
                ) : null
              }
            />
          ))
        )}
      </SettingsSection>
      {personaDelegatesAny(personas) ? (
        <SettingsSection {...searchableSetting("bots-team")}>
          <div className="px-4 py-5">
            <PersonaTeamMap personas={personas} />
          </div>
        </SettingsSection>
      ) : null}
      {dialog !== null && !readOnly && (dialog.mode === "add" || editingConfig !== undefined) ? (
        <PersonaDialog
          onClose={() => setDialog(null)}
          environmentId={environmentId}
          {...(dialog.mode === "edit" && editingConfig !== undefined
            ? { existing: { id: dialog.id, config: editingConfig } }
            : {})}
        />
      ) : null}
    </>
  );
}

function RemovePersonaButton({
  name,
  onConfirm,
}: {
  readonly name: string;
  readonly onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${name}`}
        onClick={() => setOpen(true)}
      >
        <XIcon aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {name} disappears from @ mentions. Messages that already mention it keep the
              responsibilities they were sent with.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Remove bot
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

/** Who a bot may hand work to, for its row. */
function delegateNames(
  id: PersonaId,
  persona: PersonaConfig,
  personas: Readonly<Record<PersonaId, PersonaConfig>>,
): string {
  if (persona.delegatesTo === "all") return "Hands work to all bots";
  const names = personaDelegateIds(id, persona, personas).flatMap(
    (target) => personas[target]?.name ?? [],
  );
  return names.length === 0 ? "Works alone" : `Hands work to ${names.join(", ")}`;
}

function personaDelegatesAny(personas: Readonly<Record<PersonaId, PersonaConfig>>): boolean {
  return (Object.entries(personas) as Array<[PersonaId, PersonaConfig]>).some(
    ([id, persona]) => personaDelegateIds(id, persona, personas).length > 0,
  );
}
