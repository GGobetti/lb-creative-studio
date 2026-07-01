export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("?")[0]
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2]
      return u.searchParams.get("v")
    }
  } catch {}
  return null
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = extractYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")
  } catch {
    return false
  }
}

export function isInstagramUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname.includes("instagram.com") || u.hostname.includes("instagr.am")
  } catch {
    return false
  }
}
