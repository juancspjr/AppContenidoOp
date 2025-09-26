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
    if (!markdown || typeof markdown !== 'string') {
        logger.log('ERROR', 'parserUtils', 'Input vacío o inválido', { type: typeof markdown });
        throw new Error('Respuesta de IA vacía o inválida. Intenta de nuevo.');
    }

    // Pre-cleaning for Gemini 2.5 edge cases
    let cleanedMarkdown = markdown
        .replace(/^ny\s*/i, '')           // Specific Gemini 2.5 bug: "ny" prefix
        .replace(/^\s*```json/i, '```json') // Normalize start of block
        .replace(/```\s*$/, '```')          // Normalize end of block
        .trim();

    logger.log('DEBUG', 'parserUtils', 'Iniciando parseo', { 
        length: cleanedMarkdown.length,
        preview: cleanedMarkdown.substring(0, 100)
    });

    // 1. Try to find and parse a markdown code block.
    const jsonRegex = /```(json)?\s*([\s\S]*?)\s*```/g;
    const matches = [...cleanedMarkdown.matchAll(jsonRegex)];
    if (matches.length > 0) {
        const jsonContent = matches[matches.length - 1][2]?.trim();
        if (jsonContent) {
            try {
                const parsed = JSON.parse(jsonContent);
                logger.log('SUCCESS', 'parserUtils', '✅ JSON parseado desde markdown block');
                return parsed;
            } catch (e) {
                logger.log('WARNING', 'parserUtils', "Markdown block falló, intentando reparación", { 
                    content: jsonContent.substring(0, 200),
                    error: (e as Error).message
                });
                
                // Enhanced repair
                try {
                    const repairedJson = jsonContent
                        .replace(/,\s*([}\]])/g, '$1')          // Trailing commas
                        .replace(/([}\]]),\s*$/g, '$1')         // Final trailing comma
                        .replace(/\\n/g, '\\\\n')               // Escape newlines
                        .replace(/\n(?=\s*[}\]])/g, '')         // Remove newlines before closers
                        .replace(/\t/g, ' ')                    // Tabs to spaces
                        .replace(/\r/g, '');                    // Remove carriage returns
                    
                    const parsed = JSON.parse(repairedJson);
                    logger.log('SUCCESS', 'parserUtils', '✅ JSON reparado exitosamente');
                    return parsed;
                } catch (repairError) {
                    logger.log('DEBUG', 'parserUtils', 'Reparación falló, continuando con extracción');
                }
            }
        }
    }

    // 2. Find the main JSON object using a balancing algorithm.
    let startIndex = -1;
    let endIndex = -1;
    let openChar = '';
    let closeChar = '';

    const firstBrace = cleanedMarkdown.indexOf('{');
    const firstBracket = cleanedMarkdown.indexOf('[');

    if (firstBrace === -1 && firstBracket === -1) {
        logger.log('ERROR', 'parserUtils', 'No se encontró estructura JSON', { 
            preview: cleanedMarkdown.substring(0, 300) 
        });
        throw new Error('No se encontró JSON válido en la respuesta de IA. Intenta de nuevo.');
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
    let escapeNext = false;

    for (let i = startIndex; i < cleanedMarkdown.length; i++) {
        const char = cleanedMarkdown[i];
        
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
        }

        if (inString) continue;

        if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
        }

        if (depth === 0 && i > startIndex) {
            endIndex = i;
            break;
        }
    }

    if (startIndex !== -1 && endIndex !== -1) {
        const potentialJson = cleanedMarkdown.substring(startIndex, endIndex + 1);
        
        try {
            const parsed = JSON.parse(potentialJson);
            logger.log('SUCCESS', 'parserUtils', '✅ JSON extraído correctamente');
            return parsed;
        } catch (e) {
            logger.log('WARNING', 'parserUtils', 'JSON extraído inválido, reparación final', {
                json: potentialJson.substring(0, 200),
                error: (e as Error).message
            });
            
            try {
                // More aggressive final repair
                const ultraRepairedJson = potentialJson
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/\\n/g, '\\\\n')
                    .replace(/\n/g, ' ')
                    .replace(/\t/g, ' ')
                    .replace(/\r/g, '')
                    .replace(/,(\s*[}\]])/g, '$1')
                    .replace(/"\s*\n\s*"/g, '" "')
                    .replace(/\s+/g, ' ')
                    .replace(/([^"\\])\n/g, '$1')
                    .trim();
                
                const parsed = JSON.parse(ultraRepairedJson);
                logger.log('SUCCESS', 'parserUtils', '✅ JSON reparado con estrategia agresiva');
                return parsed;
            } catch (repairError) {
                logger.log('ERROR', 'parserUtils', 'Fallo total después de todas las estrategias', {
                    original: potentialJson.substring(0, 300),
                    error: (repairError as Error).message,
                    fullResponse: cleanedMarkdown.substring(0, 500)
                });
                throw new Error(`No se pudo parsear la respuesta de IA. Error: ${(repairError as Error).message}`);
            }
        }
    }

    logger.log('ERROR', 'parserUtils', 'Extracción completamente fallida', { 
        markdown: cleanedMarkdown.substring(0, 500) 
    });
    throw new Error('No se pudo extraer JSON válido de la respuesta de IA. La respuesta puede estar malformada.');
}