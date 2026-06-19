// src/lib/image-to-svg.ts
// Client-side pipeline: Raster image → imagetracerjs SVG
// Returns the SVG string ready for Three.js SVGLoader

'use client'

// @ts-expect-error - imagetracerjs has no @types package
import ImageTracer from 'imagetracerjs'

/**
 * Main pipeline: HTMLImageElement → cleaned SVG string
 * Uses imagetracerjs for in-browser tracing without Node polyfills.
 */
export async function imageToSvg(
  image: HTMLImageElement,
  options: {
    threshold?: number
  } = {},
): Promise<string> {
  const { threshold = 128 } = options

  // Get raw image data using a canvas
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // Configure ImageTracer
  // We use a custom configuration tailored for silhouette/FDM generation (black and white)
  const tracerOptions = {
    colorquantcycles: 1,
    colorsampling: 0,
    numberofcolors: 2, // b/w
    mincolorratio: 0,
    blurradius: 0,
    blurdelta: 20,
    strokewidth: 1,
    linefilter: true,
    scale: 1,
    roundcoords: 1,
    viewbox: false,
    desc: false,
    lcpr: 0,
    qcpr: 0,
    // Provide a simple palette for B/W mapping based on the threshold
    pal: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 255 }
    ]
  }

  return new Promise<string>((resolve) => {
    // Generate SVG string directly from image data
    const svgString = ImageTracer.imagedataToSVG(imageData, tracerOptions)
    resolve(svgString)
  })
}

/**
 * Loads an image file (File object) and returns both
 * the object URL and the HTMLImageElement.
 */
export async function loadImageFile(file: File): Promise<{
  url: string
  element: HTMLImageElement
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ url, element: img })
    img.onerror = reject
    img.src = url
  })
}
