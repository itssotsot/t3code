import { buildTraitsTriggerDisplay } from "@t3tools/client-runtime/model-traits";
import type { ModelSelection, ProviderInstanceId } from "@t3tools/contracts";
import { getProviderOptionDescriptors } from "@t3tools/shared/model";

import { selectsPlanAgent } from "../../modelSelection";
import { getProviderModelCapabilities } from "../../providerModels";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { resolveModelPickerSelectedModel } from "../chat/ModelPickerContent";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { getDisplayModelName, type ModelEsque } from "../chat/providerIconUtils";

/** An agent's model as the pickers show it: provider icon, model name, and effort. */
export function PersonaModelSummary(props: {
  modelSelection: ModelSelection;
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  planModeEnabled: boolean;
}) {
  const { instanceId, model, options } = props.modelSelection;
  const entry = props.instanceEntries.find((candidate) => candidate.instanceId === instanceId);
  const selectedModel = resolveModelPickerSelectedModel({
    driverKind: entry?.driverKind,
    model,
    options: props.modelOptionsByInstance.get(instanceId) ?? [],
  });
  const effort = entry
    ? buildTraitsTriggerDisplay({
        provider: entry.driverKind,
        descriptors: getProviderOptionDescriptors({
          caps: getProviderModelCapabilities(
            entry.models,
            model,
            entry.driverKind,
            props.planModeEnabled || selectsPlanAgent(options),
          ),
          selections: options,
        }),
        primarySelectDescriptorId: null,
        ultrathinkPromptControlled: false,
        modelSelection: props.modelSelection,
      }).label
    : "";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {entry ? (
        <ProviderInstanceIcon
          driverKind={entry.driverKind}
          displayName={entry.displayName}
          accentColor={entry.accentColor}
          acpRegistryAgentId={entry.acpRegistryAgentId}
          acpRegistryIconUrl={entry.acpRegistryIconUrl}
          className="size-3.5 shrink-0"
          iconClassName="size-3.5"
        />
      ) : null}
      <span className="truncate">
        {selectedModel ? getDisplayModelName(selectedModel) : model}
        {effort ? ` · ${effort}` : ""}
        {entry ? "" : " (provider unavailable)"}
      </span>
    </span>
  );
}
