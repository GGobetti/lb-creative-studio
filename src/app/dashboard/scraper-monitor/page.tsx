import { redirect } from "next/navigation"
import { getSupabaseServer } from "@/lib/supabase"
import { ScraperMonitor } from "@/components/dashboard/ScraperMonitor"

export const metadata = {
  title: "Scraper Monitor",
}

export default async function ScraperMonitorPage() {
  const supabase = await getSupabaseServer()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single()

  if (profile?.role !== "sysadmin") {
    redirect("/dashboard")
  }

  return <ScraperMonitor />
}
