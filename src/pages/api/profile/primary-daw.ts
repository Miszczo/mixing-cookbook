import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { PRIMARY_DAW_IDS } from "@/lib/primary-daw";

export const prerender = false;

const dawIdSchema = z.enum(PRIMARY_DAW_IDS);

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  let submitted: unknown;
  try {
    submitted = (await context.request.formData()).get("daw_id");
  } catch {
    submitted = null;
  }

  const parsed = dawIdSchema.safeParse(submitted);
  if (!parsed.success) {
    return context.redirect("/dashboard?error=invalid_daw", 303);
  }

  const { error } = await supabase
    .from("daw_profiles")
    .upsert({ user_id: user.id, daw_id: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return context.redirect("/dashboard", 303);
};
