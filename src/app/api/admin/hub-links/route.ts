import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUserClient } from "@/lib/supabase"
import { CreateHubLinkSchema } from "@/types/hub-links"
import { verifyAdminAccess } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""
    await verifyAdminAccess(token)

    const supabase = getSupabaseUserClient(token)
    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error fetching hub links:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch hub links" },
      { status: err.status || 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""
    await verifyAdminAccess(token)

    const body = await req.json()
    const validated = CreateHubLinkSchema.parse(body)

    const supabase = getSupabaseUserClient(token)

    // Get max position for this theme
    const { data: existing } = await supabase
      .from("hub_theme_links")
      .select("position")
      .eq("theme", validated.theme)
      .order("position", { ascending: false })
      .limit(1)

    const nextPosition = (existing?.[0]?.position ?? -1) + 1

    const { data, error } = await supabase
      .from("hub_theme_links")
      .insert({
        ...validated,
        position: nextPosition,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating hub link:", err)
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: err.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: err.message || "Failed to create hub link" },
      { status: err.status || 500 }
    )
  }
}
