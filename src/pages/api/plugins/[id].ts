import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { pluginInputSchema } from "@/lib/plugins";

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

  const form = await context.request.formData();
  const table = supabase.from("plugins");
  const now = new Date().toISOString();
  let query;

  switch (form.get("action")) {
    case "update": {
      const parsed = pluginInputSchema.safeParse({ name: form.get("name"), plugin_type: form.get("plugin_type") });
      if (!parsed.success) {
        return context.redirect("/plugins?error=invalid_plugin", 303);
      }
      query = table.update({ ...parsed.data, updated_at: now }).eq("id", id.data);
      break;
    }
    case "favorite":
      query = table.update({ is_favorite: form.get("is_favorite") === "true", updated_at: now }).eq("id", id.data);
      break;
    case "delete":
      query = table.delete().eq("id", id.data);
      break;
    default:
      return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  // RLS hides another user's row, so a foreign id changes nothing and returns no rows.
  const { data, error } = await query.select("id");
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  if (data.length === 0) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return context.redirect("/plugins", 303);
};
