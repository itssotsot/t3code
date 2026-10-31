import type { PersonaContextRecord } from "@t3tools/contracts";

import { ContextChip, ContextChipLabel } from "./ContextChip";
import { PersonaFace } from "./PersonaFace";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/**
 * Inline chip for a mentioned agent, in the composer and in sent messages. Shows the name,
 * face, and responsibilities the message was sent with, not the agent's current settings.
 */
export function PersonaContextChip(props: {
  record: Pick<PersonaContextRecord, "label" | "faceSeed" | "responsibilities">;
  copyMarkdown?: string;
}) {
  const responsibilities = props.record.responsibilities.trim();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ContextChip
            kind="persona"
            tabIndex={0}
            aria-label={`Bot, ${props.record.label}`}
            data-markdown-copy={props.copyMarkdown}
          >
            <PersonaFace seed={props.record.faceSeed} />
            <ContextChipLabel>{props.record.label}</ContextChipLabel>
          </ContextChip>
        }
      />
      <TooltipPopup side="top" className="max-w-80 whitespace-pre-wrap">
        {responsibilities || "Bot"}
      </TooltipPopup>
    </Tooltip>
  );
}
