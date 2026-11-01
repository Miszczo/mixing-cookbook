/// <reference types="vitest/globals" />
import { createClient } from "@supabase/supabase-js";
import { requireAnonEnv } from "./helpers/supabase-env";

const { url, key } = requireAnonEnv();

function userClient() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedIn(email: string, password: string) {
  const client = userClient();
  const signUp = await client.auth.signUp({ email, password });
  if (signUp.error) throw signUp.error;
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: signIn.data.user.id };
}

describe("daw_profiles row rules", () => {
  it("shows the id to its owner, hides it from another user, and cannot be cleared", async () => {
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = "Daw-Rls-Passw0rd!";
    const owner = await signedIn(`daw-a-${stamp}@example.com`, password);
    const other = await signedIn(`daw-b-${stamp}@example.com`, password);

    const saved = await owner.client.from("daw_profiles").upsert({ user_id: owner.userId, daw_id: "bitwig-studio" });
    if (saved.error) throw saved.error;

    const ownerRows = await owner.client.from("daw_profiles").select("daw_id");
    if (ownerRows.error) throw ownerRows.error;
    expect(ownerRows.data.map((row) => row.daw_id as string)).toEqual(["bitwig-studio"]);

    const otherRows = await other.client.from("daw_profiles").select("daw_id");
    if (otherRows.error) throw otherRows.error;
    expect(otherRows.data.map((row) => row.daw_id as string)).not.toContain("bitwig-studio");

    const stolen = await other.client.from("daw_profiles").upsert({ user_id: owner.userId, daw_id: "reaper" });
    expect(stolen.error).not.toBeNull();

    const cleared = await owner.client.from("daw_profiles").delete().eq("user_id", owner.userId);
    expect(cleared.error).not.toBeNull();

    const afterAttacks = await owner.client.from("daw_profiles").select("daw_id");
    if (afterAttacks.error) throw afterAttacks.error;
    expect(afterAttacks.data.map((row) => row.daw_id as string)).toEqual(["bitwig-studio"]);
  }, 30_000);
});
