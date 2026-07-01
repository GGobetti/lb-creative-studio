import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUserClient } from "@/lib/supabase"
import { UpdateHubLinkSchema } from "@/types/hub-links"

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getAuthToken(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await verifyAdmin(token)
    const { id } = await params
    const body = await req.json()
    const validated = UpdateHubLinkSchema.parse(body)

    const { data, error } = await supabase
      .from("hub_theme_links")
      .update(validated)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error updating hub link:", err)
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: err.message || "Failed to update hub link" },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getAuthToken(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await verifyAdmin(token)
    const { id } = await params

    const { error } = await supabase
      .from("hub_theme_links")
      .delete()
      .eq("id", id)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("Error deleting hub link:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete hub link" },
      { status: err.status || 500 }
    )
  }
}
