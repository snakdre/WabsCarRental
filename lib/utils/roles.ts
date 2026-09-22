import { createClient } from "@/lib/supabase/server";

export type UserRole = "customer" | "manager" | "admin";

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (data?.role as UserRole) ?? "customer";
}

export function isManagerOrAdmin(role: UserRole | null): boolean {
  return role === "manager" || role === "admin";
}

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
