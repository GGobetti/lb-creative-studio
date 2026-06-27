import { getSupabaseServer } from "@/lib/supabase"

export async function verifyAdminAccess() {
  const supabase = getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const error = new Error("Unauthorized")
    ;(error as any).status = 401
    throw error
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (error || profile?.role !== "sysadmin") {
    const authError = new Error("Admin access required")
    ;(authError as any).status = 403
    throw authError
  }

  return true
}
