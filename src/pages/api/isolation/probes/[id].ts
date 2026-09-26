import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const idSchema = z.uuid();

const probeRowSchema = z.object({
  id: z.uuid(),
  note: z.string(),
});

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const idResult = idSchema.safeParse(context.params.id);
  if (!idResult.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("isolation_probes")
    .select("id, note")
    .eq("id", idResult.data)
    .maybeSingle();

  const row = probeRowSchema.safeParse(data);
  if (error) {
    return Response.json({ error: "query_failed" }, { status: 500 });
  }

  if (!row.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ id: row.data.id, note: row.data.note }, { status: 200 });
};
