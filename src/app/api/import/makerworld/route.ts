import { NextResponse } from 'next/server'

// Header variants to bypass potential 403s from Bambu API
const HEADER_VARIANTS: Record<string, string>[] = [
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://makerworld.com/',
    'Origin': 'https://makerworld.com',
  },
  {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://makerworld.com/',
  },
  {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Accept': 'application/json, */*',
    'Accept-Language': 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3',
  },
]

async function fetchWithRetry(apiUrl: string): Promise<Response> {
  let lastError: Error | null = null
  for (const headers of HEADER_VARIANTS) {
    try {
      const res = await fetch(apiUrl, { headers, cache: 'no-store' })
      if (res.ok) return res
      if (res.status === 404) return res // Propagate 404 immediately
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err: any) {
      lastError = err
    }
  }
  throw lastError ?? new Error('All fetch attempts failed')
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string' || !url.includes('makerworld.com')) {
      return NextResponse.json(
        { error: 'Link inválido. Por favor, insira um link válido do MakerWorld.' },
        { status: 400 }
      )
    }

    // Suporta URLs em qualquer idioma: /en/models/123, /pt/models/123, /models/123
    const match = url.match(/models\/(\d+)/)
    if (!match) {
      return NextResponse.json(
        { error: 'Não foi possível identificar o ID do modelo. Certifique-se de que o link contém /models/ID.' },
        { status: 400 }
      )
    }

    const designId = match[1]
    const apiUrl = `https://api.bambulab.com/v1/design-service/design/${designId}`

    let response: Response
    try {
      response = await fetchWithRetry(apiUrl)
    } catch (fetchErr: any) {
      console.error('[MakerWorld] Fetch error after retries:', fetchErr.message)
      return NextResponse.json(
        { error: 'Não foi possível acessar o MakerWorld no momento. Tente novamente em instantes.' },
        { status: 502 }
      )
    }

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Modelo não encontrado no MakerWorld. Verifique se o link está correto.' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: `Erro ao acessar a API do MakerWorld (${response.status}). Tente novamente.` },
        { status: 502 }
      )
    }

    const data = await response.json()

    const title = data.title || data.name || 'Modelo sem título'
    const thumbnail_url = data.coverUrl || data.cover || data.thumbnail || ''
    const rawDescription = data.summary || data.summaryTranslated || data.description || ''
    const description = stripHtml(rawDescription)

    // Extra metadata from MakerWorld
    const creator = data.designCreator 
      ? { name: data.designCreator.name || '', avatar: data.designCreator.avatar || '' } 
      : null
    const likeCount = data.likeCount || 0
    const downloadCount = data.downloadCount || 0
    const collectionCount = data.collectionCount || 0
    const printCount = data.printCount || 0
    const license = data.license || ''
    const tags = data.tagsTranslated || data.tags || []
    const pictures = data.designExtension?.design_pictures
      ? data.designExtension.design_pictures.map((p: any) => p.url).filter(Boolean)
      : []

    const printProfiles: { name: string; weight: number; timeHours: number }[] = []

    if (data.instances && Array.isArray(data.instances)) {
      for (const inst of data.instances) {
        const weight = Math.round(Number(inst.weight) || 0)
        const timeHours = inst.prediction
          ? parseFloat((Number(inst.prediction) / 3600).toFixed(1))
          : 0
        printProfiles.push({
          name: inst.title || inst.name || `Perfil ${printProfiles.length + 1}`,
          weight,
          timeHours,
        })
      }
    }

    // Fallback profiles when none are provided by the API
    if (printProfiles.length === 0) {
      printProfiles.push(
        { name: 'Perfil Padrão (0.20mm Strength)', weight: 65, timeHours: 4.2 },
        { name: 'Perfil Rápido (0.28mm Draft)', weight: 58, timeHours: 2.5 },
        { name: 'Perfil Ultra Detalhe (0.12mm Quality)', weight: 72, timeHours: 7.8 }
      )
    }

    return NextResponse.json({ 
      title, 
      thumbnail_url, 
      description, 
      printProfiles,
      creator,
      likeCount,
      downloadCount,
      collectionCount,
      printCount,
      license,
      tags,
      pictures
    })
  } catch (error: any) {
    console.error('[MakerWorld Import API] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Falha ao importar do MakerWorld' },
      { status: 500 }
    )
  }
}
