"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DESKS,
  INTEGRATIONS,
  SEED_DISPATCHES,
  SEED_PROFILE,
  brandFromDomain,
  hydrate,
} from "./mock-data";
import type {
  CompanyProfile,
  DeskId,
  Dispatch,
  DispatchStatus,
  Integration,
} from "./types";
import { normalizeDomain } from "./utils";

export type WireLogEntry = {
  id: string;
  text: string;
  at: string;
  tone: "filed" | "approved" | "live" | "spiked" | "edited" | "system";
};

type WireState = {
  onboarded: boolean;
  profile: CompanyProfile;
  dispatches: Dispatch[];
  integrations: Integration[];
  log: WireLogEntry[];

  seed: (rawDomain: string) => void;
  approve: (id: string) => void;
  pushLive: (id: string) => void;
  spike: (id: string) => void;
  restore: (id: string) => void;
  editDraft: (id: string, body: string) => void;
  setIntegration: (id: string, connected: boolean) => void;
  updateProfile: (patch: Partial<CompanyProfile>) => void;
  addVoiceTag: (tag: string) => void;
  removeVoiceTag: (tag: string) => void;
  resetWire: () => void;
};

const DEFAULT_DOMAIN = "northbeam.io";

function buildSeed(rawDomain: string) {
  const domain = normalizeDomain(rawDomain) || DEFAULT_DOMAIN;
  const brand = brandFromDomain(domain);
  return {
    profile: { ...hydrate(SEED_PROFILE, brand, domain), domain, brand },
    dispatches: hydrate(SEED_DISPATCHES, brand, domain),
    integrations: INTEGRATIONS.map((integration) => ({ ...integration })),
  };
}

const initial = buildSeed(DEFAULT_DOMAIN);

function entry(text: string, tone: WireLogEntry["tone"]): WireLogEntry {
  return {
    id: `log-${Math.random().toString(36).slice(2, 9)}`,
    text,
    at: new Date().toISOString(),
    tone,
  };
}

/** Newest first, capped — the sidebar ticker only ever shows a handful. */
function pushLog(log: WireLogEntry[], next: WireLogEntry) {
  return [next, ...log].slice(0, 24);
}

function setStatus(
  dispatches: Dispatch[],
  id: string,
  status: DispatchStatus,
): Dispatch[] {
  return dispatches.map((dispatch) =>
    dispatch.id === id ? { ...dispatch, status } : dispatch,
  );
}

export const useWire = create<WireState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: initial.profile,
      dispatches: initial.dispatches,
      integrations: initial.integrations,
      log: [entry("Wire initialised. Desks standing by.", "system")],

      seed: (rawDomain) => {
        const next = buildSeed(rawDomain);
        set({
          onboarded: true,
          ...next,
          log: [
            entry(`${next.dispatches.length} dispatches filed on ${next.profile.domain}.`, "filed"),
            entry(`All ${DESKS.length} desks connected to ${next.profile.domain}.`, "system"),
          ],
        });
      },

      approve: (id) => {
        const dispatch = get().dispatches.find((item) => item.id === id);
        if (!dispatch) return;
        set((state) => ({
          dispatches: setStatus(state.dispatches, id, "approved"),
          log: pushLog(state.log, entry(`Approved: ${dispatch.headline}`, "approved")),
        }));
      },

      pushLive: (id) => {
        const dispatch = get().dispatches.find((item) => item.id === id);
        if (!dispatch) return;
        set((state) => ({
          dispatches: setStatus(state.dispatches, id, "live"),
          log: pushLog(state.log, entry(`Running on the wire: ${dispatch.headline}`, "live")),
        }));
      },

      spike: (id) => {
        const dispatch = get().dispatches.find((item) => item.id === id);
        if (!dispatch) return;
        set((state) => ({
          dispatches: setStatus(state.dispatches, id, "spiked"),
          log: pushLog(state.log, entry(`Spiked: ${dispatch.headline}`, "spiked")),
        }));
      },

      restore: (id) => {
        set((state) => ({
          dispatches: setStatus(state.dispatches, id, "pending"),
          log: pushLog(state.log, entry("Dispatch pulled back from the spike.", "filed")),
        }));
      },

      editDraft: (id, body) => {
        const dispatch = get().dispatches.find((item) => item.id === id);
        if (!dispatch) return;
        set((state) => ({
          dispatches: state.dispatches.map((item) =>
            item.id === id
              ? { ...item, body, editedAt: new Date().toISOString() }
              : item,
          ),
          log: pushLog(state.log, entry(`Draft revised: ${dispatch.headline}`, "edited")),
        }));
      },

      setIntegration: (id, connected) => {
        const integration = get().integrations.find((item) => item.id === id);
        if (!integration) return;
        set((state) => ({
          integrations: state.integrations.map((item) =>
            item.id === id ? { ...item, connected } : item,
          ),
          log: pushLog(
            state.log,
            entry(
              `${integration.name} ${connected ? "connected" : "disconnected"}.`,
              "system",
            ),
          ),
        }));
      },

      updateProfile: (patch) =>
        set((state) => {
          const domain = patch.domain
            ? normalizeDomain(patch.domain)
            : state.profile.domain;
          return {
            profile: {
              ...state.profile,
              ...patch,
              domain,
              brand: patch.brand ?? brandFromDomain(domain),
            },
            log: pushLog(state.log, entry("Masthead updated from the profile desk.", "system")),
          };
        }),

      addVoiceTag: (tag) =>
        set((state) => {
          const clean = tag.trim();
          if (!clean || state.profile.voice.includes(clean)) return state;
          return {
            profile: { ...state.profile, voice: [...state.profile.voice, clean] },
          };
        }),

      removeVoiceTag: (tag) =>
        set((state) => ({
          profile: {
            ...state.profile,
            voice: state.profile.voice.filter((item) => item !== tag),
          },
        })),

      resetWire: () => {
        const next = buildSeed(get().profile.domain);
        set({
          ...next,
          onboarded: true,
          log: [entry("Wire reset. Desks re-filed the morning edition.", "system")],
        });
      },
    }),
    {
      name: "emory-wire-v1",
      version: 1,
    },
  ),
);

/* ---------- selectors ---------- */

export const selectVisible = (state: WireState) =>
  state.dispatches.filter((dispatch) => dispatch.status !== "spiked");

export function editionStats(dispatches: Dispatch[]) {
  const visible = dispatches.filter((item) => item.status !== "spiked");
  return {
    filed: visible.length,
    pending: visible.filter((item) => item.status === "pending").length,
    approved: visible.filter((item) => item.status === "approved").length,
    live: visible.filter((item) => item.status === "live").length,
    spiked: dispatches.filter((item) => item.status === "spiked").length,
    urgent: visible.filter(
      (item) => item.priority === "urgent" && item.status === "pending",
    ).length,
  };
}

export function deskLoad(dispatches: Dispatch[]) {
  const load = {} as Record<DeskId, number>;
  for (const desk of DESKS) load[desk.id] = 0;
  for (const dispatch of dispatches) {
    if (dispatch.status === "spiked") continue;
    load[dispatch.deskId] = (load[dispatch.deskId] ?? 0) + 1;
  }
  return load;
}
