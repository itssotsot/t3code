import { type PersonaConfig, type PersonaId, personaDelegateIds } from "@t3tools/contracts";
import { useId, useState } from "react";

import { cn } from "../../lib/utils";
import { PersonaFace } from "../PersonaFace";

const SLOT = 104;
const ROW = 108;
const FACE = 44;
const RADIUS = FACE / 2 + 4;
const LABEL_CHARS = 14;

type Point = { readonly x: number; readonly y: number };
type Node = Point & { readonly id: PersonaId; readonly depth: number; readonly bot: PersonaConfig };
type Edge = { readonly from: Node; readonly to: Node };

/**
 * Lays out who hands work to whom in rows: bots nobody hands work to on top, each delegate one
 * row below the first bot that reaches it. Bots outside every handoff are left out.
 */
function teamLayout(personas: Readonly<Record<PersonaId, PersonaConfig>>) {
  const bots = (Object.entries(personas) as Array<[PersonaId, PersonaConfig]>).toSorted(
    ([, left], [, right]) => left.name.localeCompare(right.name),
  );
  const targets = new Map(bots.map(([id, bot]) => [id, personaDelegateIds(id, bot, personas)]));
  const linked = new Set([...targets].flatMap(([id, to]) => (to.length > 0 ? [id, ...to] : [])));
  const members = bots.filter(([id]) => linked.has(id));
  const received = new Set([...targets.values()].flat());
  const depth = new Map<PersonaId, number>();
  const reach = (root: PersonaId) => {
    depth.set(root, 0);
    const queue = [root];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      for (const to of targets.get(id) ?? []) {
        if (depth.has(to)) continue;
        depth.set(to, depth.get(id)! + 1);
        queue.push(to);
      }
    }
  };
  for (const [id] of members) if (!received.has(id)) reach(id);
  // Bots that all hand work to each other have no top; start from the busiest.
  for (;;) {
    const rest = members.filter(([id]) => !depth.has(id));
    const root = rest.toSorted(
      ([left], [right]) => (targets.get(right)?.length ?? 0) - (targets.get(left)?.length ?? 0),
    )[0];
    if (root === undefined) break;
    reach(root[0]);
  }
  const rows = new Map<number, Array<[PersonaId, PersonaConfig]>>();
  for (const member of members) {
    const row = depth.get(member[0])!;
    rows.set(row, [...(rows.get(row) ?? []), member]);
  }
  const width = Math.max(...[...rows.values()].map((row) => row.length)) * SLOT;
  const nodes = new Map<PersonaId, Node>();
  for (const [row, entries] of rows) {
    entries.forEach(([id, bot], index) => {
      const x = (width - entries.length * SLOT) / 2 + SLOT * (index + 0.5);
      nodes.set(id, { id, bot, depth: row, x, y: 12 + FACE / 2 + row * ROW });
    });
  }
  const edges = [...nodes.values()].flatMap((from) =>
    (targets.get(from.id) ?? []).flatMap((to) => {
      const target = nodes.get(to);
      return target === undefined ? [] : [{ from, to: target }];
    }),
  );
  return { nodes: [...nodes.values()], edges, width, height: rows.size * ROW };
}

const along = (from: Point, toward: Point, distance: number): Point => {
  const length = Math.hypot(toward.x - from.x, toward.y - from.y) || 1;
  return {
    x: from.x + ((toward.x - from.x) / length) * distance,
    y: from.y + ((toward.y - from.y) / length) * distance,
  };
};

/** Straight down one row; anything else bends, so opposite handoffs don't overlap. */
function edgePath({ from, to }: Edge): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const bend = to.depth === from.depth + 1 ? 0 : Math.max(28, length * 0.22);
  const control = {
    x: (from.x + to.x) / 2 + ((from.y - to.y) / length) * bend,
    y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * bend,
  };
  const start = along(from, control, RADIUS);
  const end = along(to, control, RADIUS + 4);
  return `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`;
}

const truncate = (name: string) =>
  name.length > LABEL_CHARS ? `${name.slice(0, LABEL_CHARS - 1)}…` : name;

/** Who hands work to whom. Pointing at a bot picks out its handoffs. */
export function PersonaTeamMap(props: {
  readonly personas: Readonly<Record<PersonaId, PersonaConfig>>;
}) {
  const [focused, setFocused] = useState<PersonaId | null>(null);
  const markerPrefix = `persona-team-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { nodes, edges, width, height } = teamLayout(props.personas);
  if (edges.length === 0) return null;
  const summary = nodes
    .flatMap((node) => {
      const to = edges.filter((edge) => edge.from === node).map((edge) => edge.to.bot.name);
      return to.length === 0 ? [] : [`${node.bot.name} hands work to ${to.join(", ")}.`];
    })
    .join(" ");
  const touches = (edge: Edge, id: PersonaId) => edge.from.id === id || edge.to.id === id;
  return (
    <svg
      role="img"
      aria-label={summary}
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto block w-full"
      style={{ maxWidth: width }}
    >
      <defs>
        {(["muted", "strong"] as const).map((tone) => (
          <marker
            key={tone}
            id={`${markerPrefix}-${tone}`}
            viewBox="0 0 8 8"
            refX="4"
            refY="4"
            markerWidth="8"
            markerHeight="8"
            markerUnits="userSpaceOnUse"
            orient="auto"
            className={tone === "strong" ? "text-foreground" : "text-muted-foreground/60"}
          >
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        ))}
      </defs>
      {edges.map((edge) => {
        const strong = focused !== null && edge.from.id === focused;
        return (
          <path
            key={`${edge.from.id}-${edge.to.id}`}
            d={edgePath(edge)}
            fill="none"
            stroke="currentColor"
            strokeWidth={strong ? 1.5 : 1}
            markerEnd={`url(#${markerPrefix}-${strong ? "strong" : "muted"})`}
            className={cn(
              "transition-opacity duration-150",
              strong ? "text-foreground" : "text-muted-foreground/60",
              focused !== null && !touches(edge, focused) && "opacity-15",
            )}
          />
        );
      })}
      {nodes.map((node) => (
        <g
          key={node.id}
          onPointerEnter={() => setFocused(node.id)}
          onPointerLeave={() => setFocused(null)}
          className={cn(
            "transition-opacity duration-150",
            focused !== null &&
              focused !== node.id &&
              !edges.some((edge) => touches(edge, focused) && touches(edge, node.id)) &&
              "opacity-40",
          )}
        >
          <foreignObject x={node.x - FACE / 2} y={node.y - FACE / 2} width={FACE} height={FACE}>
            <PersonaFace seed={node.bot.faceSeed} className="size-full" />
          </foreignObject>
          <text
            x={node.x}
            y={node.y + FACE / 2 + 16}
            textAnchor="middle"
            className="fill-foreground text-xs"
          >
            {truncate(node.bot.name)}
          </text>
        </g>
      ))}
    </svg>
  );
}
