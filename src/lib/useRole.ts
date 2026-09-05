"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";

export interface Me { email: string; role: string; isAdmin: boolean; canManageTemplates?: boolean; pinned?: boolean }

// Module-level cache: every component on a page shares one /api/auth/me fetch.
let cached: Me | null = null;
let inflight: Promise<Me | null> | null = null;

async function fetchMe(): Promise<Me | null> {
  const r = await apiFetch("/api/auth/me");
  if (!r.ok) return null;
  const j = (await r.json().catch(() => null)) as Me | null;
  return j;
}

/**
 * The caller's identity for role-aware UI (hide admin-only controls for
 * members). Server routes enforce the real permission checks — this is UX only.
 * `isAdmin` is false until the fetch resolves (admin controls pop in a moment
 * later rather than briefly showing to members); `me` is null while unknown.
 */
export function useRole(): { me: Me | null; isAdmin: boolean; canManageTemplates: boolean } {
  const [me, setMe] = useState<Me | null>(cached);
  useEffect(() => {
    if (cached) return;
    inflight ??= fetchMe().then((m) => { cached = m; return m; });
    void inflight.then((m) => setMe(m));
  }, []);
  return {
    me,
    isAdmin: me?.isAdmin ?? false,
    // Members may author templates; older sessions predating this field fall
    // back to the admin answer rather than hiding the form from an admin.
    canManageTemplates: me ? me.canManageTemplates ?? me.isAdmin : false,
  };
}
