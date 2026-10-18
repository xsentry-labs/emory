import type { DB } from "./db";
import { getKv } from "./inbound";
import { isLlmConfigured } from "./llm";
import { TRACK_IDS, type TrackId } from "./report";

/**
 * Where Emory works, per track, and whether each place is usable right now.
 * "planned" connectors are listed so the setup page shows the whole picture,
 * but they can't be switched on yet.
 */

export type ConnectionState = "connected" | "ready" | "available" | "planned";

export interface Connection {
  id: string;
  track: TrackId;
  name: string;
  detail: string;
  state: ConnectionState;
  /** Short status text shown beside the row. */
  status: string;
}

export const TRACK_NAMES: Record<TrackId, string> = {
  site: "site · fix my site",
  leads: "leads · find and reach leads",
  social: "engage · grow on x and reddit",
};

/** The server mailbox belongs to exactly one workspace (SENDING_WORKSPACE_ID). */
export const serverSendsFor = (workspaceId: number, env: Record<string, string | undefined> = process.env) =>
  Number(env.SENDING_WORKSPACE_ID) === workspaceId && Boolean(env.SMTP_URL && env.FROM_EMAIL);

export function listConnections(workspaceId: number, env: Record<string, string | undefined> = process.env): Connection[] {
  const ai = isLlmConfigured();
  const mailbox = serverSendsFor(workspaceId, env);
  return [
    {
      id: "site-source",
      track: "site",
      name: "website source",
      detail: "github, wordpress, webflow or shopify, so fixes arrive as a pull request or cms draft. emory never publishes.",
      state: "planned",
      status: "next update",
    },
    {
      id: "steps",
      track: "site",
      name: "no access · written steps",
      detail: "every fix comes with the exact title, description or markup to paste.",
      state: "ready",
      status: "ready",
    },
    {
      id: "search-console",
      track: "site",
      name: "google search console",
      detail: "so results show clicks and rankings before and after each fix.",
      state: "planned",
      status: "next update",
    },
    {
      id: "lead-search",
      track: "leads",
      name: "lead search",
      detail: "ai web search for companies that match your ideal customer, each linked to its source.",
      state: ai ? "ready" : "available",
      status: ai ? "ready" : "needs OPENROUTER_API_KEY",
    },
    {
      id: "apollo",
      track: "leads",
      name: "apollo · people and emails",
      detail: "contacts, verified emails and org charts for each account.",
      state: "planned",
      status: "coming soon",
    },
    {
      id: "inbox",
      track: "leads",
      name: "email inbox",
      detail: mailbox
        ? `approved emails go out from ${env.FROM_EMAIL}; replies are read from the inbox.`
        : "until a mailbox is connected, approved emails are copied into your own mail app to send.",
      state: mailbox ? "connected" : "ready",
      status: mailbox ? "connected" : "send by hand",
    },
    {
      id: "x",
      track: "social",
      name: "x",
      detail: "posts, replies and mentions. drafts can be copied to x today.",
      state: "planned",
      status: "coming soon",
    },
    {
      id: "reddit",
      track: "social",
      name: "reddit",
      detail: "finds threads where people ask for what you do. a first reply never has a link.",
      state: "planned",
      status: "coming soon",
    },
  ];
}

export function chosenTracks(db: DB): TrackId[] {
  try {
    const v = JSON.parse(getKv(db, "tracks") ?? "null");
    if (Array.isArray(v)) return TRACK_IDS.filter((t) => v.includes(t));
  } catch {
    /* fall through */
  }
  return [...TRACK_IDS];
}

/** What Emory may do on its own. Today the answer is always the same: nothing outbound without a person. */
export const PERMISSIONS: { what: string; rule: string }[] = [
  { what: "site fixes", rule: "pr, draft or steps only" },
  { what: "first emails", rule: "with your approval" },
  { what: "follow-ups", rule: "with your approval" },
  { what: "posts on x and reddit", rule: "with your approval" },
  { what: "replies to people", rule: "with your approval" },
];
