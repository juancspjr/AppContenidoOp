/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Converts a File object into a base64 encoded string, without the data URL prefix.
 * @param file The file to convert.
 * @returns A promise that resolves with the base64 string.
 */
// FIX: Export fileToBase64 to be used in other services.
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // The result includes the data URL prefix (e.g., "data:image/jpeg;base64,"),
      // which we need to remove before sending to the Gemini API.
      const base64Data = result.split(',')[1];
      if (!base64Data) {
        reject(new Error("Failed to extract base64 data from file."));
      } else {
        resolve(base64Data);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a File object into a GoogleGenerativeAI.Part object.
 * @param file The file to convert.
 * @param mimeTypeOverride Optional. A string to override the file's default MIME type.
 * @returns A promise that resolves with the Part object.
 */
export async function fileToGenerativePart(file: File, mimeTypeOverride?: string) {
  const base64EncodedData = await fileToBase64(file);
  return {
    inlineData: {
      mimeType: mimeTypeOverride || file.type,
      data: base64EncodedData
    }
  };
}