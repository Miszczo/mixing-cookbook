import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { trackInputSchema } from "@/lib/tracks";

export const prerender = false;

const idSchema = z.uuid();

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const id = idSchema.safeParse(context.params.id);
  if (!id.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let form: FormData | null;
  try {
    form = await context.request.formData();
  } catch {
    form = null;
  }
  const parsed = trackInputSchema.safeParse({ name: form?.get("name"), stage: form?.get("stage") });
  if (!parsed.success) {
    return context.redirect(`/tracks/${id.data}?error=invalid_track`, 303);
  }

  // RLS hides another user's row, so a foreign id changes nothing and returns no rows.
  const { data, error } = await supabase
    .from("tracks")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id.data)
    .select("id");
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  if (data.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return context.redirect(`/tracks/${id.data}`, 303);
};
