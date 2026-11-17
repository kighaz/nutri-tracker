import { createSupabaseServerClient } from "@/lib/supabase";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type Guard =
  | { ok: true; supabase: ServerClient; userId: string }
  | { ok: false; error: "error.unauthenticated" | "error.rateLimited" };

/**
 * Server-only gate for every action that costs money or quota (Gemini, USDA, OpenFoodFacts):
 * 1. the caller must be signed in, 2. the caller must be under `max` calls per `windowSeconds`.
 * Fails closed: if the rate-limit function is missing or errors, the call is refused.
 */
export async function guard(action: string, max: number, windowSeconds: number): Promise<Guard> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "error.unauthenticated" };
  const { data: allowed, error } = await supabase.rpc("consume_rate_limit", {
    p_action: action,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error || allowed !== true) return { ok: false, error: "error.rateLimited" };
  return { ok: true, supabase, userId: data.user.id };
}
