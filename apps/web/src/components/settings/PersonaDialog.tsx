import {
  type EnvironmentId,
  type ModelSelection,
  type PersonaConfig,
  PersonaId,
  PERSONA_NAME_MAX_CHARS,
  PERSONA_RESPONSIBILITIES_MAX_CHARS,
  type ProviderInstanceId,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { ChevronDownIcon, DicesIcon } from "lucide-react";
import { useState } from "react";

import { useEnvironmentSettings, useUpdateEnvironmentSettings } from "../../hooks/useSettings";
import { randomUUID } from "../../lib/utils";
import {
  getCustomModelOptionsByInstance,
  resolveAppModelSelectionState,
  selectsPlanAgent,
} from "../../modelSelection";
import { providerInstanceEntriesFor } from "../../providerInstances";
import { useEnvironmentProviders } from "../../state/environments";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { TraitsPicker } from "../chat/TraitsPicker";
import { PersonaFace } from "../PersonaFace";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Menu, MenuCheckboxItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { SETTINGS_PICKER_TRIGGER_CLASSNAME } from "./settingsLayout";

/** Mounted per open, so each open starts from a fresh draft. */
export function PersonaDialog({
  onClose,
  environmentId,
  existing,
}: {
  readonly onClose: () => void;
  readonly environmentId: EnvironmentId;
  readonly existing?: { readonly id: PersonaId; readonly config: PersonaConfig };
}) {
  const settings = useEnvironmentSettings(environmentId);
  const updateSettings = useUpdateEnvironmentSettings(environmentId);
  const providers = useEnvironmentProviders().get(environmentId) ?? EMPTY_SERVER_PROVIDERS;
  const instanceEntries = providerInstanceEntriesFor(providers, settings, null);
  const [name, setName] = useState(existing?.config.name ?? "");
  const [responsibilities, setResponsibilities] = useState(existing?.config.responsibilities ?? "");
  const [faceSeed, setFaceSeed] = useState(existing?.config.faceSeed ?? randomUUID);
  const [modelSelection, setModelSelection] = useState<ModelSelection>(
    () =>
      existing?.config.modelSelection ??
      settings.defaultModelSelection ??
      resolveAppModelSelectionState(settings, providers),
  );
  const [canEditCode, setCanEditCode] = useState(existing?.config.canEditCode ?? true);
  const [delegatesTo, setDelegatesTo] = useState<PersonaConfig["delegatesTo"]>(
    existing?.config.delegatesTo ?? [],
  );
  const otherBots = (Object.entries(settings.personas) as Array<[PersonaId, PersonaConfig]>)
    .filter(([id]) => id !== existing?.id)
    .toSorted(([, left], [, right]) => left.name.localeCompare(right.name));
  const isChosen = (id: PersonaId) => delegatesTo === "all" || delegatesTo.includes(id);
  const chosenBots = otherBots.filter(([id]) => isChosen(id));
  // Unchecking one bot under "All bots" keeps the rest, as a fixed list.
  const toggleDelegate = (id: PersonaId, checked: boolean) => {
    const current = chosenBots.map(([chosen]) => chosen).filter((chosen) => chosen !== id);
    setDelegatesTo(checked ? [...current, id] : current);
  };
  const [submitted, setSubmitted] = useState(false);
  const trimmedName = name.trim();
  const nameError = submitted && trimmedName === "" ? "Give the bot a name." : undefined;

  const modelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    providers,
    modelSelection.instanceId,
    modelSelection.model,
  );
  const instanceEntry = instanceEntries.find(
    (entry) => entry.instanceId === modelSelection.instanceId,
  );
  const getModelDisabledReason = (instanceId: ProviderInstanceId) => {
    const entry = instanceEntries.find((candidate) => candidate.instanceId === instanceId);
    return entry?.enabled && entry.isAvailable ? null : "Not available on this environment.";
  };

  const save = () => {
    setSubmitted(true);
    if (trimmedName === "") return;
    const id = existing?.id ?? PersonaId.make(randomUUID());
    updateSettings({
      personas: {
        [id]: {
          name: trimmedName,
          responsibilities: responsibilities.trim(),
          modelSelection,
          faceSeed,
          canEditCode,
          // A bot deleted while this dialog was open drops out of the list.
          delegatesTo: delegatesTo === "all" ? "all" : chosenBots.map(([id]) => id),
        },
      },
    });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.config.name}` : "Add a bot"}</DialogTitle>
          <DialogDescription>
            Mention a bot with @ in a chat to give it the turn. It answers on its model and effort,
            with its responsibilities as instructions.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            id="persona-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="flex flex-col items-center gap-2 pb-1">
              <PersonaFace seed={faceSeed} className="size-28" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFaceSeed(randomUUID())}
              >
                <DicesIcon aria-hidden />
                New face
              </Button>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="persona-name">Name</Label>
              <Input
                id="persona-name"
                placeholder="Reviewer"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={PERSONA_NAME_MAX_CHARS}
                aria-invalid={nameError !== undefined}
                aria-describedby={nameError !== undefined ? "persona-name-error" : undefined}
                autoFocus
              />
              {nameError !== undefined ? (
                <p id="persona-name-error" role="alert" className="text-xs text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="persona-responsibilities">Responsibilities</Label>
              <Textarea
                id="persona-responsibilities"
                placeholder="Reviews changes for correctness and missed edge cases. Doesn't edit files."
                value={responsibilities}
                onChange={(event) => setResponsibilities(event.target.value)}
                maxLength={PERSONA_RESPONSIBILITIES_MAX_CHARS}
                rows={4}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Model and effort</Label>
              <div className="flex flex-wrap items-center gap-2">
                <ProviderModelPicker
                  environmentId={environmentId}
                  activeInstanceId={modelSelection.instanceId}
                  model={modelSelection.model}
                  lockedProvider={null}
                  instanceEntries={instanceEntries}
                  modelOptionsByInstance={modelOptionsByInstance}
                  triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                  triggerAriaLabel="Bot model"
                  getModelDisabledReason={getModelDisabledReason}
                  onInstanceModelChange={(instanceId, model) =>
                    setModelSelection(createModelSelection(instanceId, model))
                  }
                />
                {instanceEntry ? (
                  <TraitsPicker
                    provider={instanceEntry.driverKind}
                    models={instanceEntry.models}
                    model={modelSelection.model}
                    modelOptions={modelSelection.options ?? []}
                    allowPromptInjectedEffort={false}
                    planModeEnabled={
                      settings.planModeEnabled || selectsPlanAgent(modelSelection.options)
                    }
                    triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                    onModelOptionsChange={(options) =>
                      setModelSelection(
                        createModelSelection(
                          modelSelection.instanceId,
                          modelSelection.model,
                          options,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={canEditCode}
                onCheckedChange={(checked) => setCanEditCode(checked === true)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Can edit code</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Unchecked, it only reads: it's told not to edit and runs supervised, so any change
                  waits for your approval.
                </span>
              </span>
            </label>
            <div className="grid gap-1.5">
              <Label>Can hand work to</Label>
              <Menu>
                <MenuTrigger
                  render={
                    <Button type="button" variant="outline" size="sm" className="justify-between" />
                  }
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {chosenBots.slice(0, 4).map(([id, bot]) => (
                      <PersonaFace key={id} seed={bot.faceSeed} className="size-4 shrink-0" />
                    ))}
                    <span className="truncate">
                      {delegatesTo === "all"
                        ? "All bots"
                        : chosenBots.length === 0
                          ? "No bots"
                          : chosenBots.map(([, bot]) => bot.name).join(", ")}
                    </span>
                  </span>
                  <ChevronDownIcon aria-hidden />
                </MenuTrigger>
                <MenuPopup align="start">
                  <MenuCheckboxItem
                    checked={delegatesTo === "all"}
                    onCheckedChange={(checked) => setDelegatesTo(checked ? "all" : [])}
                    closeOnClick={false}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span>All bots</span>
                      <span className="text-xs text-muted-foreground">
                        Includes bots you add later
                      </span>
                    </span>
                  </MenuCheckboxItem>
                  {otherBots.length > 0 ? <MenuSeparator /> : null}
                  {otherBots.map(([id, bot]) => (
                    <MenuCheckboxItem
                      key={id}
                      checked={isChosen(id)}
                      onCheckedChange={(checked) => toggleDelegate(id, checked)}
                      closeOnClick={false}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <PersonaFace seed={bot.faceSeed} className="size-4 shrink-0" />
                        <span className="truncate">{bot.name}</span>
                      </span>
                    </MenuCheckboxItem>
                  ))}
                </MenuPopup>
              </Menu>
              <p className="text-xs leading-snug text-muted-foreground">
                It can start tasks for these bots. With none, it works alone.
              </p>
            </div>
          </form>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="persona-form" disabled={nameError !== undefined}>
            {existing ? "Save changes" : "Add bot"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
