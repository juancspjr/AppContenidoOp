/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Renders the user-painted mask with a configurable feather (blur) effect.
export async function renderFeatheredMask(
  maskStrokesCanvas: HTMLCanvasElement,
  featherPx: number,
): Promise<HTMLCanvasElement> {
  const src = maskStrokesCanvas;
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  
  ctx.drawImage(src, 0, 0);
  
  if (featherPx > 0) {
    ctx.filter = `blur(${featherPx}px)`;
    // Draw it back onto itself to apply the blur
    ctx.drawImage(dst, 0, 0);
    ctx.filter = 'none';
  }
  
  return dst;
}

// Takes a base image and a mask, and returns a new canvas with a transparent "hole"
// punched out where the mask is.
export async function cutAlphaHole(
  baseImage: HTMLImageElement,
  featheredMask: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const w = baseImage.naturalWidth;
  const h = baseImage.naturalHeight;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  
  ctx.drawImage(baseImage, 0, 0, w, h);
  
  // Use 'destination-out' to erase pixels from the base image using the mask
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(featheredMask, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  
  return out;
}

// The final, crucial step. It takes the original image, the AI's edited version,
// and the mask, and produces a final image where the AI's changes are ONLY
// visible inside the mask. This prevents any "leaks".
export async function compositeOnlyInsideMask(
  originalImage: HTMLImageElement | HTMLCanvasElement,
  aiEditedCanvas: HTMLCanvasElement,
  featheredMask: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const w = 'naturalWidth' in originalImage ? originalImage.naturalWidth : originalImage.width;
  const h = 'naturalHeight' in originalImage ? originalImage.naturalHeight : originalImage.height;
  const final = document.createElement('canvas');
  final.width = w;
  final.height = h;
  const ctx = final.getContext('2d')!;
  
  // 1. Start with the original image
  ctx.drawImage(originalImage, 0, 0, w, h);
  
  // 2. Create a temporary canvas with just the AI's edit, clipped to the mask
  const maskedAI = document.createElement('canvas');
  maskedAI.width = w;
  maskedAI.height = h;
  const mctx = maskedAI.getContext('2d')!;
  mctx.drawImage(aiEditedCanvas, 0, 0, w, h);
  mctx.globalCompositeOperation = 'destination-in';
  mctx.drawImage(featheredMask, 0, 0, w, h);
  
  // 3. Draw the masked AI edit on top of the original image
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(maskedAI, 0, 0, w, h);
  
  return final;
}

// Optional verification function to check if the AI modified pixels outside the mask.
export function changedOutsideMask(
  beforeCanvas: HTMLCanvasElement,
  afterCanvas: HTMLCanvasElement,
  featheredMask: HTMLCanvasElement,
  tolerance: number = 5
): boolean {
  if (beforeCanvas.width !== afterCanvas.width || beforeCanvas.height !== afterCanvas.height) {
    console.warn("Cannot compare canvases with different dimensions.");
    return true; // Treat dimension mismatch as a change
  }
  const w = beforeCanvas.width;
  const h = beforeCanvas.height;
  const bctx = beforeCanvas.getContext('2d', { willReadFrequently: true })!;
  const actx = afterCanvas.getContext('2d', { willReadFrequently: true })!;
  const mctx = featheredMask.getContext('2d', { willReadFrequently: true })!;
  
  const bData = bctx.getImageData(0, 0, w, h).data;
  const aData = actx.getImageData(0, 0, w, h).data;
  const mData = mctx.getImageData(0, 0, w, h).data;

  for (let i = 0; i < bData.length; i += 4) {
    const maskAlpha = mData[i + 3]; // Alpha channel of the mask
    // If we're clearly outside the mask...
    if (maskAlpha < 5) { 
      const dr = Math.abs(aData[i] - bData[i]);
      const dg = Math.abs(aData[i + 1] - bData[i + 1]);
      const db = Math.abs(aData[i + 2] - bData[i + 2]);
      if (dr > tolerance || dg > tolerance || db > tolerance) {
        console.warn(`Change detected outside mask at pixel index ${i/4}`);
        return true; // A significant change was found
      }
    }
  }
  return false; // No significant changes found outside the mask
}

// Helper to draw an HTMLImageElement to a new canvas.
export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

// Helper to convert a Blob object (like one from an API response) into an HTMLImageElement.
export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
