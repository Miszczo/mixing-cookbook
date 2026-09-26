import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const probeBodySchema = z.object({
  note: z.string().min(1).max(200),
});

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

  const { data, error } = await supabase.from("isolation_probes").select("id, note");

  const rows = z.array(probeRowSchema).safeParse(data);
  if (error || !rows.success) {
    return Response.json({ error: "query_failed" }, { status: 500 });
  }

  return Response.json({ probes: rows.data }, { status: 200 });
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = probeBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("isolation_probes")
    .insert({
      user_id: context.locals.user.id,
      note: parsed.data.note,
    })
    .select("id, note")
    .single();

  const row = probeRowSchema.safeParse(data);
  if (error || !row.success) {
    return Response.json({ error: "insert_failed" }, { status: 500 });
  }

  return Response.json({ id: row.data.id, note: row.data.note }, { status: 201 });
};
