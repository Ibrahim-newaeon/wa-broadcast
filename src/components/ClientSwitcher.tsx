"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { useRole } from "@/lib/useRole";

interface ClientRow { id: string; name: string }

/** SUPERADMIN-only tenant switcher. Renders nothing for everyone else
 *  (the /api/clients endpoint 403s, so the control never appears). */
export default function ClientSwitcher() {
  // On a tenant subdomain the hostname decides the client, for super-admins too.
  const { me } = useRole();
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [active, setActive] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch("/api/clients")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setClients(j.clients.map((c: ClientRow) => ({ id: c.id, name: c.name })));
        setActive(j.activeClientId);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (me?.pinned) return null;
  if (!clients || clients.length === 0) return null;

  async function onSwitch(clientId: string) {
    if (clientId === active || busy) return;
    setBusy(true);
    const res = await apiFetch("/api/clients/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (res.ok) {
      setActive(clientId);
      // RSC pages read the acting-client cookie server-side — reload to refetch.
      window.location.reload();
    } else {
      setBusy(false);
    }
  }

  return (
    <label className="client-switch" title="Acting as client (super-admin)">
      <span className="client-switch__dot" aria-hidden />
      <select
        className="client-switch__select"
        value={active}
        disabled={busy}
        onChange={(e) => onSwitch(e.target.value)}
        aria-label="Switch client"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
