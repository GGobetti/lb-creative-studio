import { NextRequest, NextResponse } from "next/server"
import { getSupabaseUserClient } from "@/lib/supabase"
import { CreateHubLinkSchema } from "@/types/hub-links"

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

export async function GET(req: NextRequest) {
  try {
    const token = getAuthToken(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await verifyAdmin(token)

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
    const token = getAuthToken(req)
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await verifyAdmin(token)

    const body = await req.json()
    const validated = CreateHubLinkSchema.parse(body)

    const { data: existing } = await supabase
      .from("hub_theme_links")
      .select("position")
      .eq("theme", validated.theme)
      .order("position", { ascending: false })
      .limit(1)

    const nextPosition = (existing?.[0]?.position ?? -1) + 1

    const { data, error } = await supabase
      .from("hub_theme_links")
      .insert({ ...validated, position: nextPosition })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error("Error creating hub link:", err)
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    return NextResponse.json(
      { error: err.message || "Failed to create hub link" },
      { status: err.status || 500 }
    )
  }
}
