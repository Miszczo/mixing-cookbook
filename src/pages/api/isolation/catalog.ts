import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const catalogItemSchema = z.object({
  id: z.uuid(),
  label: z.string(),
});

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase.from("isolation_catalog").select("id, label");

  const rows = z.array(catalogItemSchema).safeParse(data);
  if (error || !rows.success) {
    return Response.json({ error: "query_failed" }, { status: 500 });
  }

  return Response.json({ items: rows.data }, { status: 200 });
};

export const POST: APIRoute = (context) => {
  if (!context.locals.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  return Response.json({ error: "forbidden" }, { status: 403 });
};
