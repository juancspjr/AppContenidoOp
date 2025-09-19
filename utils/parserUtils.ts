/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Parses a string that might contain a JSON object within a markdown code block.
 * It handles both raw JSON strings and those wrapped in ```json ... ```.
 * @param markdown The string to parse.
 * @returns The parsed JavaScript object.
 * @throws An error if the JSON is invalid.
 */
export function parseJsonMarkdown(markdown: string): any {
  // Regex to find a JSON code block, optionally with "json" language tag
  const jsonRegex = /```(json)?\s*([\s\S]*?)\s*```/;
  const match = markdown.match(jsonRegex);

  let jsonString = markdown.trim();
  
  // If a markdown block is found, use its content
  if (match && match[2]) {
    jsonString = match[2];
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON string:", jsonString);
    console.error("Original markdown from API:", markdown);
    // Provide a more informative error message
    throw new Error(`Invalid JSON response from API. Parsing failed: ${(error as Error).message}`);
  }
}
