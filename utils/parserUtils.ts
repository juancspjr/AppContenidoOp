/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { logger } from './logger';

/**
 * Parses a string that might contain a JSON object within markdown code blocks or mixed with other text.
 * This function acts as a robust "Sanitization and Repair Gateway" for AI responses.
 *
 * It follows a multi-step process:
 * 1. Tries to find and parse a clean JSON markdown block.
 * 2. If that fails, it uses a brace/bracket balancing algorithm to extract the main JSON object/array from the text.
 * 3. It attempts to parse the extracted object.
 * 4. If parsing fails, it attempts to repair common syntax errors (like trailing commas) and retries parsing.
 * 5. Provides detailed logging at each step for easier debugging.
 *
 * @param markdown The raw string from the AI response.
 * @returns The parsed JavaScript object.
 * @throws An error if no valid, repairable JSON can be found.
 */
export function parseJsonMarkdown(markdown: string): any {
  // 1. First, try to find and parse a markdown code block.
  const jsonRegex = /```(json)?\s*([\s\S]*?)\s*```/g;
  const matches = [...markdown.matchAll(jsonRegex)];
  if (matches.length > 0) {
    const jsonContent = matches[matches.length - 1][2]?.trim();
    if (jsonContent) {
      try {
        return JSON.parse(jsonContent);
      } catch (e) {
        logger.log('WARNING', 'parserUtils', "Found a JSON markdown block, but it failed to parse. Will attempt extraction.", { content: jsonContent, error: (e as Error).message });
      }
    }
  }

  // 2. If no valid markdown block, find the main JSON object in the string using a balancing algorithm.
  let startIndex = -1;
  let endIndex = -1;
  let openChar = '';
  let closeChar = '';

  const firstBrace = markdown.indexOf('{');
  const firstBracket = markdown.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    // No JSON object found at all.
    logger.log('ERROR', 'parserUtils', "Failed to parse JSON. No markdown block or object/array structure found.", { markdown });
    throw new Error(`Invalid JSON response. No valid JSON block, object, or array structure was found in the response.`);
  }

  if (firstBracket !== -1 && (firstBracket < firstBrace || firstBrace === -1)) {
    startIndex = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    startIndex = firstBrace;
    openChar = '{';
    closeChar = '}';
  }

  let depth = 0;
  let inString = false;
  for (let i = startIndex; i < markdown.length; i++) {
    const char = markdown[i];
    
    if (char === '"' && markdown[i-1] !== '\\') {
      inString = !inString;
    }

    if (inString) continue;

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
    }

    if (depth === 0) {
      endIndex = i;
      break;
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    const potentialJson = markdown.substring(startIndex, endIndex + 1);
    try {
      // 3. Attempt to parse the extracted, balanced object.
      return JSON.parse(potentialJson);
    } catch (e) {
      // 4. If it fails, attempt to repair it.
      logger.log('WARNING', 'parserUtils', "Extracted JSON object is invalid, attempting repair.", { json: potentialJson, error: (e as Error).message });
      try {
        // Repair common LLM error: trailing commas before a closing bracket or brace.
        // This regex finds a comma (,) followed by optional whitespace (\s*) right before a closing brace (}) or bracket (]).
        // It replaces this pattern with just the closing brace/bracket.
        const repairedJson = potentialJson.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repairedJson);
      } catch (repairError) {
         logger.log('ERROR', 'parserUtils', "Failed to parse JSON even after repair attempt.", { original: potentialJson, error: (repairError as Error).message });
         logger.log('DEBUG', 'parserUtils', "Original full markdown from API that failed:", markdown);
         throw new Error(`Failed to parse JSON. An object was found but appears to be malformed. Error: ${(repairError as Error).message}`);
      }
    }
  }

  // 5. Final fallback, should be rarely reached.
  logger.log('ERROR', 'parserUtils', "Could not extract a valid JSON object despite multiple strategies.", { markdown });
  throw new Error(`Invalid JSON response from API. No valid JSON block could be extracted or repaired.`);
}