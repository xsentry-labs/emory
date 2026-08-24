import { AGENT_BY_ID } from "@/lib/agents";
import type { AgentId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Colour dot plus name. Colour appears only where an agent owns the thing
 * being shown — never as decoration.
 */
export function AgentChip({
  id,
  className,
  showName = true,
}: {
  id: AgentId;
  className?: string;
  showName?: boolean;
}) {
  const agent = AGENT_BY_ID[id];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-caption text-mute", className)}>
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: agent.hex }}
      />
      {showName ? agent.short : <span className="sr-only">{agent.short}</span>}
    </span>
  );
}

export function AgentBar({ id, className }: { id: AgentId; className?: string }) {
  const agent = AGENT_BY_ID[id];
  return (
    <span
      aria-hidden
      className={cn("block w-[3px] shrink-0 rounded-full", className)}
      style={{ background: agent.hex }}
    />
  );
}

export function AgentTag({ id }: { id: AgentId }) {
  const agent = AGENT_BY_ID[id];
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-caption font-medium"
      style={{
        background: agent.hex,
        color: agent.onColor === "light" ? "#0D0D0F" : "#FFFFFF",
      }}
    >
      {agent.short}
    </span>
  );
}
