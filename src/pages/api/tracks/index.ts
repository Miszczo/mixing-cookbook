import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { trackInputSchema } from "@/lib/tracks";

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
  const parsed = trackInputSchema.safeParse({ name, stage: form.get("stage") });
  if (!parsed.success) {
    const typed = typeof name === "string" ? name.slice(0, 100) : "";
    return context.redirect(`/tracks?error=invalid_track&name=${encodeURIComponent(typed)}`, 303);
  }

  const { data, error } = await supabase
    .from("tracks")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single();
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return context.redirect(`/tracks/${data.id as string}`, 303);
};
