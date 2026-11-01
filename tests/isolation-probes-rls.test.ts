/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { requireAnonEnv } from "./helpers/supabase-env";

function rowId(row: { id?: unknown } | null): string {
  const id = row?.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("insert did not return an id");
  }
  return id;
}

function notesOf(rows: readonly { note?: unknown }[]): string[] {
  return rows.map((row) => {
    if (typeof row.note !== "string") {
      throw new Error("select did not return a note");
    }
    return row.note;
  });
}

const { url, key } = requireAnonEnv();

function userClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("isolation_probes owner select", () => {
  it("returns the owner's note and hides it from another signed-in select", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Rls-Probe-Passw0rd!";
    const emailA = `rls-a-${stamp}@example.com`;
    const emailB = `rls-b-${stamp}@example.com`;
    const note = `rls-note-${stamp}`.slice(0, 200);

    const clientA = userClient();
    const clientB = userClient();

    const signUpA = await clientA.auth.signUp({ email: emailA, password });
    if (signUpA.error) throw signUpA.error;
    const signInA = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (signInA.error) throw signInA.error;
    const userA = signInA.data.user;

    const signUpB = await clientB.auth.signUp({ email: emailB, password });
    if (signUpB.error) throw signUpB.error;
    const signInB = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (signInB.error) throw signInB.error;

    const inserted = await clientA.from("isolation_probes").insert({ user_id: userA.id, note }).select("id").single();
    if (inserted.error) throw inserted.error;
    const probeId = rowId(inserted.data);

    let assertionError: unknown;
    try {
      const ownerRows = await clientA.from("isolation_probes").select("id, note");
      if (ownerRows.error) throw ownerRows.error;
      expect(notesOf(ownerRows.data)).toContain(note);

      const otherRows = await clientB.from("isolation_probes").select("id, note");
      if (otherRows.error) throw otherRows.error;
      expect(notesOf(otherRows.data)).not.toContain(note);
    } catch (error: unknown) {
      assertionError = error;
    } finally {
      try {
        await clientA.from("isolation_probes").delete().eq("id", probeId);
      } catch {
        // A cleanup failure must not replace a failed assertion.
      }
    }

    if (assertionError instanceof Error) throw assertionError;
    if (typeof assertionError === "string") throw new Error(assertionError);
    if (assertionError) throw new Error("isolation probe assertion failed");
  });
});
