import { getSupabaseBrowser } from "@/lib/supabase"
import { HubLink, CreateHubLinkInput, UpdateHubLinkInput, ReorderInput } from "@/types/hub-links"

export async function fetchHubLinks(): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .select("*")
    .order("position", { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchHubLinksByTheme(theme: string): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .select("*")
    .eq("theme", theme)
    .order("position", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createHubLink(input: CreateHubLinkInput): Promise<HubLink> {
  const supabase = getSupabaseBrowser()

  // Get max position for this theme
  const { data: existing } = await supabase
    .from("hub_theme_links")
    .select("position")
    .eq("theme", input.theme)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = (existing?.[0]?.position ?? -1) + 1

  const { data, error } = await supabase
    .from("hub_theme_links")
    .insert({
      ...input,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateHubLink(id: string, input: UpdateHubLinkInput): Promise<HubLink> {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase
    .from("hub_theme_links")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteHubLink(id: string): Promise<void> {
  const supabase = getSupabaseBrowser()
  const { error } = await supabase
    .from("hub_theme_links")
    .delete()
    .eq("id", id)

  if (error) throw error
}

export async function reorderHubLinks(input: ReorderInput): Promise<HubLink[]> {
  const supabase = getSupabaseBrowser()

  // Update each link's position
  const promises = input.updates.map(({ id, position }) =>
    supabase
      .from("hub_theme_links")
      .update({ position })
      .eq("id", id)
  )

  await Promise.all(promises)

  // Return updated links
  return fetchHubLinks()
}
