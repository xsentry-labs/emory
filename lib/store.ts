"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BRAIN_CHANGES,
  BRAIN_FIELDS,
  CONNECTORS,
  SEED_ACTIONS,
  SEED_WORKSPACE,
  companyFromDomain,
  hydrate,
} from "./mock-data";
import type {
  ActionStatus,
  AgentId,
  BrainChange,
  BrainField,
  Connector,
  EmoryAction,
  Workspace,
} from "./types";

export function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function isValidDomain(input: string) {
  const host = normalizeDomain(input);
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host.length <= 253;
}

type EmoryState = {
  /** Audit runs without an account; onboarded means a workspace exists. */
  audited: boolean;
  onboarded: boolean;
  workspace: Workspace;
  actions: EmoryAction[];
  brain: BrainField[];
  changes: BrainChange[];
  connectors: Connector[];
  /** Autonomy is granted per action type, per customer. */
  autonomy: Record<string, boolean>;

  runAudit: (domain: string) => void;
  finishOnboarding: (answers: Record<string, string>) => void;
  approve: (id: string) => void;
  decline: (id: string) => void;
  undo: (id: string) => void;
  editProposed: (id: string, proposed: string) => void;
  promoteKind: (kind: string) => void;
  demoteKind: (kind: string) => void;
  updateBrainField: (id: string, value: string) => void;
  setConnector: (id: string, connected: boolean) => void;
  reset: () => void;
};

const DEFAULT_DOMAIN = "halden.io";

function seedFor(rawDomain: string) {
  const domain = normalizeDomain(rawDomain) || DEFAULT_DOMAIN;
  const company = companyFromDomain(domain);
  return {
    workspace: { ...hydrate(SEED_WORKSPACE, company, domain), domain, company },
    actions: hydrate(SEED_ACTIONS, company, domain),
    brain: hydrate(BRAIN_FIELDS, company, domain),
    changes: hydrate(BRAIN_CHANGES, company, domain),
    connectors: CONNECTORS.map((connector) => ({ ...connector })),
  };
}

const initial = seedFor(DEFAULT_DOMAIN);

function setStatus(
  actions: EmoryAction[],
  id: string,
  status: ActionStatus,
  ranAt?: string,
): EmoryAction[] {
  return actions.map((action) =>
    action.id === id ? { ...action, status, ranAt } : action,
  );
}

function change(
  field: string,
  before: string,
  after: string,
  why: string,
  agentId: AgentId,
): BrainChange {
  return {
    id: `bc-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
    agentId,
    field,
    before,
    after,
    why,
    source: "confirmed",
  };
}

export const useEmory = create<EmoryState>()(
  persist(
    (set, get) => ({
      audited: false,
      onboarded: false,
      workspace: initial.workspace,
      actions: initial.actions,
      brain: initial.brain,
      changes: initial.changes,
      connectors: initial.connectors,
      autonomy: {},

      runAudit: (rawDomain) => {
        const next = seedFor(rawDomain);
        set({ audited: true, ...next });
      },

      finishOnboarding: (answers) => {
        set((state) => {
          const brain = state.brain.map((field) => {
            const answer = answers[field.id];
            if (answer === undefined || answer === field.value) return field;
            return {
              ...field,
              value: answer,
              confidence: 100,
              source: "confirmed" as const,
              origin: "You corrected this during setup",
            };
          });
          return { onboarded: true, brain };
        });
      },

      approve: (id) => {
        const action = get().actions.find((item) => item.id === id);
        if (!action) return;
        set((state) => ({
          actions: setStatus(
            state.actions,
            id,
            "approved",
            new Date().toISOString(),
          ),
        }));
        // Approved work runs shortly after; the queue shows it as done.
        window.setTimeout(() => {
          set((state) => ({
            actions: state.actions.map((item) =>
              item.id === id && item.status === "approved"
                ? { ...item, status: "executed" }
                : item,
            ),
          }));
        }, 2_200);
      },

      decline: (id) => set((state) => ({ actions: setStatus(state.actions, id, "declined") })),

      undo: (id) =>
        set((state) => ({
          actions: state.actions.map((item) =>
            item.id === id ? { ...item, status: "queued", ranAt: undefined } : item,
          ),
        })),

      editProposed: (id, proposed) =>
        set((state) => ({
          actions: state.actions.map((item) =>
            item.id === id ? { ...item, proposed, edited: true } : item,
          ),
        })),

      /** Low-risk work only: everything queued of this type runs from now on. */
      promoteKind: (kind) =>
        set((state) => ({
          autonomy: { ...state.autonomy, [kind]: true },
          actions: state.actions.map((item) =>
            item.kind === kind && item.risk === "low" && item.status === "queued"
              ? { ...item, status: "executed", ranAt: new Date().toISOString() }
              : item,
          ),
        })),

      demoteKind: (kind) =>
        set((state) => ({ autonomy: { ...state.autonomy, [kind]: false } })),

      updateBrainField: (id, value) => {
        const field = get().brain.find((item) => item.id === id);
        if (!field || field.value === value) return;
        set((state) => ({
          brain: state.brain.map((item) =>
            item.id === id
              ? {
                  ...item,
                  value,
                  confidence: 100,
                  source: "confirmed",
                  origin: "You corrected this",
                }
              : item,
          ),
          changes: [
            change(
              field.label,
              field.value,
              value,
              "You corrected this. Every agent writes from it immediately.",
              "ledge",
            ),
            ...state.changes,
          ].slice(0, 40),
        }));
      },

      setConnector: (id, connected) =>
        set((state) => ({
          connectors: state.connectors.map((item) =>
            item.id === id
              ? {
                  ...item,
                  connected,
                  health: connected ? "ok" : "unavailable",
                  healthNote: connected
                    ? "Connected just now · first read within the hour"
                    : "Not connected",
                }
              : item,
          ),
        })),

      reset: () => {
        const next = seedFor(get().workspace.domain);
        set({ ...next, audited: true, onboarded: true, autonomy: {} });
      },
    }),
    { name: "emory-v2", version: 2 },
  ),
);

/* ---------- selectors ---------- */

export const queued = (actions: EmoryAction[]) =>
  actions.filter((action) => action.status === "queued");

export const done = (actions: EmoryAction[]) =>
  actions.filter((action) => action.status === "approved" || action.status === "executed");

export function queueSummary(actions: EmoryAction[]) {
  const open = queued(actions);
  return {
    queued: open.length,
    high: open.filter((action) => action.risk === "high").length,
    low: open.filter((action) => action.risk === "low").length,
    done: done(actions).length,
    declined: actions.filter((action) => action.status === "declined").length,
  };
}

export function agentLoad(actions: EmoryAction[]) {
  const load: Partial<Record<AgentId, number>> = {};
  for (const action of actions) {
    if (action.status !== "queued") continue;
    load[action.agentId] = (load[action.agentId] ?? 0) + 1;
  }
  return load;
}
