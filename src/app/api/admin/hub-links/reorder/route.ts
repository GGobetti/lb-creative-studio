import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUserClient } from "@/lib/supabase"
import { ReorderSchema } from "@/types/hub-links"

function getAuthToken(req: NextRequest): string | null {
  return req.headers.get("authorization")?.replace("Bearer ", "") || null
}

async function verifyAdmin(token: string) {
  const supabase = getSupabaseUserClient(token)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw Object.assign(new Error("Unauthorized"), { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "sysadmin") throw Object.assign(new Error("Forbidden"), { status: 403 })
  return supabase
}

export async function PUT(req: NextRequest) {
  try {
    const token = getAuthToken(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await verifyAdmin(token)

    const body = await req.json()
    const validated = ReorderSchema.parse(body)

    await Promise.all(
      validated.updates.map(({ id, position }) =>
        supabase.from("hub_theme_links").update({ position }).eq("id", id)
      )
    )

    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error reordering hub links:", err)
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: err.message || "Failed to reorder hub links" },
      { status: err.status || 500 }
    )
  }
}
