import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";

export const PDF_OCR_RASTER_SCALE = 3;
export const PDF_PHOTO_RASTER_SCALE = 1.5;
export const BRIDGE_PHOTO_JPEG_QUALITY = 80;
const LOW_CONTRAST_LUMINANCE_VARIANCE = 40;

interface PdfCanvasAndContext {
  canvas: Canvas | null;
  context: SKRSContext2D | null;
}

export function createPdfCanvasFactory(): {
  create(width: number, height: number): PdfCanvasAndContext;
  destroy(canvasAndContext: PdfCanvasAndContext): void;
  reset(canvasAndContext: PdfCanvasAndContext, width: number, height: number): void;
} {
  return {
    create(width: number, height: number): PdfCanvasAndContext {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(
      canvasAndContext: PdfCanvasAndContext,
      width: number,
      height: number
    ): void {
      if (canvasAndContext.canvas === null) {
        throw new Error("PDF canvas was already destroyed.");
      }
      canvasAndContext.canvas.width = Math.ceil(width);
      canvasAndContext.canvas.height = Math.ceil(height);
    },
    destroy(canvasAndContext: PdfCanvasAndContext): void {
      if (canvasAndContext.canvas !== null) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
      }
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
}

export async function rasterizePdfPage(
  page: RasterizablePdfPage,
  canvasFactory: ReturnType<typeof createPdfCanvasFactory>,
  scale = PDF_OCR_RASTER_SCALE
): Promise<Uint8Array> {
  return withRenderedPdfPage(page, canvasFactory, scale, (canvas) =>
    Promise.resolve(new Uint8Array(canvas.toBuffer("image/png")))
  );
}

export async function rasterizePdfPageJpeg(
  page: RasterizablePdfPage,
  canvasFactory: ReturnType<typeof createPdfCanvasFactory>,
  scale = PDF_PHOTO_RASTER_SCALE
): Promise<Uint8Array | null> {
  return withRenderedPdfPage(page, canvasFactory, scale, (canvas) => {
    if (isLowContrastCanvas(canvas)) {
      return Promise.resolve(null);
    }
    return Promise.resolve(
      new Uint8Array(canvas.toBuffer("image/jpeg", BRIDGE_PHOTO_JPEG_QUALITY))
    );
  });
}

interface RasterizablePdfPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvas: Canvas;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

async function withRenderedPdfPage<T>(
  page: RasterizablePdfPage,
  canvasFactory: ReturnType<typeof createPdfCanvasFactory>,
  scale: number,
  useCanvas: (canvas: Canvas) => Promise<T>
): Promise<T> {
  const viewport = page.getViewport({ scale });
  const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
  if (canvasAndContext.canvas === null) {
    throw new Error("PDF page canvas could not be created.");
  }
  try {
    await page.render({
      canvas: canvasAndContext.canvas,
      viewport
    }).promise;
    return await useCanvas(canvasAndContext.canvas);
  } finally {
    canvasFactory.destroy(canvasAndContext);
  }
}

function isLowContrastCanvas(canvas: Canvas): boolean {
  const width = canvas.width;
  const height = canvas.height;
  if (width < 8 || height < 8) {
    return true;
  }
  const context = canvas.getContext("2d");
  const { data } = context.getImageData(0, 0, width, height);
  const pixelCount = width * height;
  const step = Math.max(1, Math.floor(pixelCount / 4_000)) * 4;
  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let index = 0; index + 2 < data.length; index += step) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    sum += luminance;
    sumSquares += luminance * luminance;
    count += 1;
  }

  if (count < 16) {
    return true;
  }
  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;
  return variance < LOW_CONTRAST_LUMINANCE_VARIANCE;
}
