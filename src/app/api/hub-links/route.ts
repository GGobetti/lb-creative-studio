import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUserClient } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
    const supabase = getSupabaseUserClient(token)

    const { data, error } = await supabase
      .from("hub_theme_links")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("Error fetching hub links:", err)
    return NextResponse.json(
      { error: err.message || "Failed to fetch hub links" },
      { status: 500 }
    )
  }
}
