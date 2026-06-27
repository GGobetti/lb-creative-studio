import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer } from "@/lib/supabase"
import { ReorderSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth"

export async function PUT(req: NextRequest) {
  try {
    await verifyAdminAccess()

    const body = await req.json()
    const validated = ReorderSchema.parse(body)

    const supabase = getSupabaseServer()

    // Update each link's position
    await Promise.all(
      validated.updates.map(({ id, position }) =>
        supabase
          .from("hub_theme_links")
          .update({ position })
          .eq("id", id)
      )
    )

    // Return updated links
    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error reordering hub links:", err)
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err.message || "Failed to reorder hub links" },
      { status: err.status || 500 }
    )
  }
}
