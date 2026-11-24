import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { findRecipe } from "@/lib/recipes";

export const prerender = false;

const idSchema = z.uuid();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle-step"), step: z.string(), done: z.enum(["true", "false"]) }),
  z.object({ action: z.literal("choose-tool"), tool: z.union([z.literal("auto"), z.literal("native"), z.uuid()]) }),
]);

export const POST: APIRoute = async (context) => {
  const { user } = context.locals;
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const id = idSchema.safeParse(context.params.id);
  const recipeId = context.params.recipeId;
  if (!id.success || !recipeId) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const recipe = await findRecipe(supabase, recipeId);
  if (recipe === "error") {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  if (!recipe) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // RLS hides another user's track, so a foreign id reads as missing.
  const track = await supabase.from("tracks").select("stage").eq("id", id.data).maybeSingle();
  if (track.error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
  if (!track.data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const trackPath = `/tracks/${id.data}`;
  if (track.data.stage !== "miks") {
    return context.redirect(trackPath, 303);
  }

  const recipePath = `${trackPath}?recipe=${recipe.id}`;
  const invalid = () => context.redirect(`${recipePath}&error=invalid_recipe_action`, 303);

  let form: FormData | null;
  try {
    form = await context.request.formData();
  } catch {
    form = null;
  }
  const parsed = actionSchema.safeParse({
    action: form?.get("action"),
    step: form?.get("step"),
    done: form?.get("done"),
    tool: form?.get("tool"),
  });
  if (!parsed.success) {
    return invalid();
  }

  let changes: { completed_steps: string[] } | { selected_plugin_id: string | null; use_native: boolean };

  if (parsed.data.action === "toggle-step") {
    const { step, done } = parsed.data;
    if (!recipe.steps.some((candidate) => candidate.id === step)) {
      return invalid();
    }
    const current = await supabase
      .from("track_recipe_progress")
      .select("completed_steps")
      .eq("track_id", id.data)
      .eq("recipe_id", recipe.id)
      .maybeSingle();
    if (current.error) {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
    const completed = new Set((current.data?.completed_steps ?? []) as string[]);
    if (done === "true") {
      completed.add(step);
    } else {
      completed.delete(step);
    }
    changes = { completed_steps: recipe.steps.map((item) => item.id).filter((item) => completed.has(item)) };
  } else {
    const { tool } = parsed.data;
    if (tool === "auto" || tool === "native") {
      changes = { selected_plugin_id: null, use_native: tool === "native" };
    } else {
      const plugin = await supabase
        .from("plugins")
        .select("id")
        .eq("id", tool)
        .eq("plugin_type", recipe.requiredType)
        .maybeSingle();
      if (plugin.error) {
        return Response.json({ error: "save_failed" }, { status: 500 });
      }
      if (!plugin.data) {
        return invalid();
      }
      changes = { selected_plugin_id: tool, use_native: false };
    }
  }

  // Each action writes only its own columns, so it cannot clear the other's.
  const { error } = await supabase.from("track_recipe_progress").upsert(
    {
      track_id: id.data,
      recipe_id: recipe.id,
      user_id: user.id,
      updated_at: new Date().toISOString(),
      ...changes,
    },
    { onConflict: "track_id,recipe_id" },
  );
  if (error) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return context.redirect(recipePath, 303);
};
