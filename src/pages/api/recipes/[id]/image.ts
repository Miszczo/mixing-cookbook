import type { APIRoute } from "astro";
import { z } from "zod";
import { decodeImage, type RecipeImageMime } from "@/lib/recipe-input";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const idSchema = z.uuid();

const imageRowSchema = z.object({
  image_data: z.string(),
  image_mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export const GET: APIRoute = async (context) => {
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

  const { data, error } = await supabase
    .from("recipes")
    .select("image_data, image_mime")
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  const row = imageRowSchema.safeParse(data);
  if (!row.success) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeImage(row.data.image_data);
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const mime: RecipeImageMime = row.data.image_mime;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
};
