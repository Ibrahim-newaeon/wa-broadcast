import { test, expect, request, type APIRequestContext } from "@playwright/test";

// Proves multi-tenant isolation end-to-end against the running app:
//   • a super-admin acting as client A cannot see client B's data (and vice-versa)
//   • a regular client user is pinned to their own client, cannot switch, and a
//     forged `acid` cookie is ignored (no cross-tenant escalation)
//   • the same phone can exist in two clients (per-client uniqueness)
// The throwaway tenants it creates are deleted in a finally block.
//
// Requires a SUPERADMIN login (the env/seed admin) via E2E_EMAIL / E2E_PASSWORD.
// Skips when unset so CI without secrets stays green.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Tenant isolation", () => {
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD (a SUPERADMIN) to run");

  test("clients cannot read or mutate each other's data", async ({ baseURL }) => {
    const stamp = Date.now();
    const phone = "1555" + String(stamp).slice(-7); // same number used in BOTH clients
    const url = new URL(baseURL!);

    const sa = await request.newContext({ baseURL });
    let clientA = "";
    let clientB = "";
    let ub: APIRequestContext | undefined;
    let forged: APIRequestContext | undefined;

    const login = (ctx: APIRequestContext, em: string, pw: string) =>
      ctx.post("/api/auth/login", { data: { email: em, password: pw } });

    try {
      // ── super-admin session ──────────────────────────────────────────────
      expect((await login(sa, email!, password!)).ok()).toBeTruthy();
      expect((await sa.get("/api/clients")).status(), "E2E_EMAIL must be a SUPERADMIN").toBe(200);

      const makeClient = async (name: string) => {
        const r = await sa.post("/api/clients", { data: { name, slug: `${name}-${stamp}` } });
        expect(r.ok(), await r.text()).toBeTruthy();
        return (await r.json()).client.id as string;
      };
      clientA = await makeClient(`isoa${stamp}`);
      clientB = await makeClient(`isob${stamp}`);

      const switchTo = async (cid: string) =>
        expect((await sa.post("/api/clients/switch", { data: { clientId: cid } })).ok()).toBeTruthy();

      // Seed a list + contact under whichever client the super-admin is acting as.
      const seed = async (label: string) => {
        const lr = await sa.post("/api/lists", { data: { name: `list-${label}-${stamp}` } });
        expect(lr.ok()).toBeTruthy();
        const listId = (await lr.json()).list.id as string;
        const cr = await sa.post("/api/contacts", { data: { firstName: label, phone, listId } });
        expect(cr.ok(), await cr.text()).toBeTruthy(); // same phone succeeds in both clients
        return { listId, contactId: (await cr.json()).contact.id as string };
      };

      await switchTo(clientA);
      const a = await seed("alpha");
      await switchTo(clientB);
      const b = await seed("bravo");
      expect(a.contactId).not.toBe(b.contactId);

      // While acting as B: see B's data, never A's.
      const idsB = (await (await sa.get(`/api/contacts?query=${phone}`)).json()).contacts.map((c: { id: string }) => c.id);
      expect(idsB).toContain(b.contactId);
      expect(idsB).not.toContain(a.contactId);

      const listsB = (await (await sa.get("/api/lists")).json()).lists.map((l: { id: string }) => l.id);
      expect(listsB).toContain(b.listId);
      expect(listsB).not.toContain(a.listId);

      // Acting as B, cannot mutate A's contact by id.
      expect((await sa.patch(`/api/contacts/${a.contactId}`, { data: { name: "hijacked" } })).status()).toBe(404);

      // Symmetric: acting as A sees A's contact, not B's.
      await switchTo(clientA);
      const idsA = (await (await sa.get(`/api/contacts?query=${phone}`)).json()).contacts.map((c: { id: string }) => c.id);
      expect(idsA).toContain(a.contactId);
      expect(idsA).not.toContain(b.contactId);

      // ── a regular client user (created in B) is pinned & cannot escalate ──
      await switchTo(clientB);
      const userEmail = `user-${stamp}@example.test`;
      const userPw = "Test1234!pw";
      expect((await sa.post("/api/users", { data: { email: userEmail, password: userPw, role: "ADMIN" } })).ok()).toBeTruthy();

      ub = await request.newContext({ baseURL });
      expect((await login(ub, userEmail, userPw)).ok()).toBeTruthy();

      // Not a super-admin: no client management, no switching.
      expect((await ub.get("/api/clients")).status()).toBe(403);
      expect((await ub.post("/api/clients/switch", { data: { clientId: clientA } })).status()).toBe(403);

      // Sees only B's data.
      const ubIds = (await (await ub.get(`/api/contacts?query=${phone}`)).json()).contacts.map((c: { id: string }) => c.id);
      expect(ubIds).toContain(b.contactId);
      expect(ubIds).not.toContain(a.contactId);

      // Forge an `acid` cookie pointing at client A — must be IGNORED for a
      // non-super-admin (no cross-tenant read or write).
      const state = await ub.storageState();
      state.cookies.push({
        name: "acid", value: clientA, domain: url.hostname, path: "/",
        expires: -1, httpOnly: true, secure: url.protocol === "https:", sameSite: "Lax",
      });
      forged = await request.newContext({ baseURL, storageState: state });
      const forgedIds = (await (await forged.get(`/api/contacts?query=${phone}`)).json()).contacts.map((c: { id: string }) => c.id);
      expect(forgedIds, "forged acid must not expose client A").toContain(b.contactId);
      expect(forgedIds).not.toContain(a.contactId);
      expect((await forged.patch(`/api/contacts/${a.contactId}`, { data: { name: "hijacked" } })).status()).toBe(404);
    } finally {
      // Clean up the throwaway tenants (cascades their data).
      if (clientA) await sa.delete(`/api/clients/${clientA}`).catch(() => {});
      if (clientB) await sa.delete(`/api/clients/${clientB}`).catch(() => {});
      await sa.dispose();
      if (ub) await ub.dispose();
      if (forged) await forged.dispose();
    }
  });
});
