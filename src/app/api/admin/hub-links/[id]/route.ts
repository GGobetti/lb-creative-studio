import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase"
import { UpdateHubLinkSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAccess()

    const { id } = await params
    const body = await req.json()
    const validated = UpdateHubLinkSchema.parse(body)

    const supabase = getSupabaseServer()
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
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
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
    await verifyAdminAccess()

    const { id } = await params
    const supabase = getSupabaseServer()
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

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (err: any) {
    console.error("Error deleting hub link:", err)
    return NextResponse.json(
      { error: err.message || "Failed to delete hub link" },
      { status: err.status || 500 }
    )
  }
}
