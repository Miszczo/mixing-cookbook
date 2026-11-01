import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { pluginInputSchema } from "@/lib/plugins";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const form = await context.request.formData();
  const name = form.get("name");
  const parsed = pluginInputSchema.safeParse({ name, plugin_type: form.get("plugin_type") });
  if (!parsed.success) {
    const typed = typeof name === "string" ? name.slice(0, 100) : "";
    return context.redirect(`/plugins?error=invalid_plugin&name=${encodeURIComponent(typed)}`, 303);
  }

  const { error } = await supabase.from("plugins").insert({ ...parsed.data, user_id: user.id });
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return context.redirect("/plugins", 303);
};
