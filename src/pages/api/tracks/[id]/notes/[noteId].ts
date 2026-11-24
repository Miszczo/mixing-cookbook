import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const paramsSchema = z.object({ id: z.uuid(), noteId: z.uuid() });
const actionSchema = z.object({ action: z.literal("delete") });

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const params = paramsSchema.safeParse(context.params);
  if (!params.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let form: FormData | null;
  try {
    form = await context.request.formData();
  } catch {
    form = null;
  }
  if (!actionSchema.safeParse({ action: form?.get("action") }).success) {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  // RLS limits the delete to the caller's own notes, so a foreign note matches no row.
  const { data, error } = await supabase
    .from("listening_notes")
    .delete()
    .eq("id", params.data.noteId)
    .eq("track_id", params.data.id)
    .select("id");
  if (error) {
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
  if (data.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return context.redirect(`/tracks/${params.data.id}#notes`, 303);
};
