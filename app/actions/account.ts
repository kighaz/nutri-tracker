"use server";

import { createSupabaseServerClient } from "@/lib/supabase";
import type { ActionResult } from "@/types/diary";

const TABLES = ["user_profiles", "custom_foods", "custom_recipes", "recipe_ingredients", "meal_logs", "meal_log_items"] as const;

/** RGPD Art. 15 / 20: everything stored about the caller, as a JSON-serialisable object. */
export async function exportMyData(): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, error: "error.unauthenticated" };

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at },
  };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", user.id);
    if (error) return { ok: false, error: "common.error" };
    out[table] = data ?? [];
  }
  return { ok: true, data: out };
}

/** RGPD Art. 17: deletes every row of the caller AND their auth.users record (SQL function). */
export async function deleteMyAccount(): Promise<ActionResult<true>> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "error.unauthenticated" };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: "common.error" };

  try {
    await supabase.auth.signOut(); // clears the session cookies; the user no longer exists
  } catch {
    /* session already invalid */
  }
  return { ok: true, data: true };
}
