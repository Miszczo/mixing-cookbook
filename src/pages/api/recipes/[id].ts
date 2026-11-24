import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const idSchema = z.uuid();

// HTML forms only send POST, so the form names the action.
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

  if (form?.get("action") !== "delete") {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  // RLS hides another user's row, so a foreign id deletes nothing and returns no rows.
  const { data, error } = await supabase.from("recipes").delete().eq("id", id.data).select("id");
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  if (data.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return context.redirect("/recipes", 303);
};
