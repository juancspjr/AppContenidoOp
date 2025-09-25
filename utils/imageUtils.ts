/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { logger } from './logger';

/**
 * Slices an image blob into a grid of smaller blobs.
 * @param imageBlob The source image blob.
 * @param rows The number of rows in the grid.
 * @param cols The number of columns in the grid.
 * @returns A promise that resolves with an array of blobs for each grid cell.
 */
export async function sliceImageIntoGrid(
  imageBlob: Blob,
  rows: number,
  cols: number
): Promise<Blob[]> {
  try {
    const imageBitmap = await createImageBitmap(imageBlob);
    const { width, height } = imageBitmap;
    const cellWidth = Math.floor(width / cols);
    const cellHeight = Math.floor(height / rows);
    const blobs: Blob[] = [];

    const canvas = document.createElement('canvas');
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.clearRect(0, 0, cellWidth, cellHeight);
        ctx.drawImage(
          imageBitmap,
          c * cellWidth, // source x
          r * cellHeight, // source y
          cellWidth,     // source width
          cellHeight,    // source height
          0,             // destination x
          0,             // destination y
          cellWidth,     // destination width
          cellHeight     // destination height
        );
        const newBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (newBlob) {
          blobs.push(newBlob);
        } else {
            logger.log('WARNING', 'sliceImageIntoGrid', `Failed to create blob for cell row ${r}, col ${c}.`);
        }
      }
    }

    imageBitmap.close(); // Release memory
    return blobs;
  } catch (error) {
    logger.log('ERROR', 'sliceImageIntoGrid', 'Failed to slice image into grid', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}