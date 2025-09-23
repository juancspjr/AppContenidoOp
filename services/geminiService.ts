/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEYS } from '../config/secure_config';
import { logger } from '../utils/logger';
import { parseJsonMarkdown } from '../utils/parserUtils';
import { fileToGenerativePart } from "../utils/fileUtils";

import type {
    InitialConcept,
    StyleAndFormat,
    CharacterDefinition,
    StoryStructure,
    StructuralCoherenceReport,
    StoryMasterplan,
    Critique,
    Documentation,
    HookMatrix,
    ReferenceAsset
} from '../components/story-builder/types';
import type { GenerateImagesResponse as GoogleImagesResponse, GenerateVideosOperation } from '@google/genai';

// ============================================================================
// 🚀 PROXY DE FRONTEND RESILIENTE Y TRANSPARENTE v2.0
// ============================================================================
// Este servicio actúa como un proxy en el lado del cliente. Gestiona un pool
// de claves de API de forma explícita, con estados individuales para cada
// clave, logs detallados para transparencia y manejo de errores inteligente
// que distingue entre límites de tasa temporales y cuotas diarias agotadas.
// ============================================================================

type ApiKeyStatus = 'AVAILABLE' | 'COOLDOWN' | 'EXHAUSTED_QUOTA';

interface ApiKey {
    key: string;
    maskedKey: string; // Para logging seguro
    status: ApiKeyStatus;
    cooldownUntil?: number;
    client: GoogleGenAI;
}

let apiKeyPool: ApiKey[] = [];
let currentKeyIndex = 0;
const COOLDOWN_PERIOD = 60 * 1000; // 1 minuto de cooldown

/**
 * Inicializa (o reinicializa) el pool de claves de API.
 * Se asegura de que cada clave tenga un estado y un cliente de API asociado.
 */
function initializeApiKeyPool() {
    // Solo se reinicializa si el número de claves en la configuración cambia.
    if (apiKeyPool.length > 0 && apiKeyPool.length === GEMINI_API_KEYS.length) return;

    logger.log('INFO', 'geminiService', `Inicializando pool con ${GEMINI_API_KEYS.length} claves de API.`);
    apiKeyPool = GEMINI_API_KEYS.map(key => ({
        key: key,
        maskedKey: `...${key.slice(-4)}`,
        status: 'AVAILABLE',
        client: new GoogleGenAI({ apiKey: key })
    }));
    currentKeyIndex = 0;
}

/**
 * Encuentra la siguiente clave disponible en el pool, saltando las que están en cooldown o agotadas.
 * @returns Un objeto con la clave y su índice, o null si ninguna está disponible.
 */
function getNextAvailableKey(): { apiKey: ApiKey; index: number } | null {
    const totalKeys = apiKeyPool.length;
    if (totalKeys === 0) return null;

    // Itera sobre el pool completo desde el último índice conocido.
    for (let i = 0; i < totalKeys; i++) {
        const keyIndex = (currentKeyIndex + i) % totalKeys;
        const apiKey = apiKeyPool[keyIndex];

        // Si una clave estaba en cooldown, comprueba si ya puede usarse de nuevo.
        if (apiKey.status === 'COOLDOWN' && apiKey.cooldownUntil && Date.now() > apiKey.cooldownUntil) {
            apiKey.status = 'AVAILABLE';
            apiKey.cooldownUntil = undefined;
            logger.log('INFO', 'geminiService', `Clave ${apiKey.maskedKey} (Índice ${keyIndex}) ha salido del cooldown.`);
        }

        // Si la clave está disponible, la devuelve.
        if (apiKey.status === 'AVAILABLE') {
            currentKeyIndex = keyIndex; // Actualiza el punto de partida para la siguiente búsqueda.
            return { apiKey, index: keyIndex };
        }
    }
    
    return null; // No se encontraron claves disponibles.
}

/**
 * Motor central para realizar llamadas a la API de Gemini con lógica de reintento,
 * rotación de claves transparente y manejo de errores granular.
 * @param requestFn Una función que recibe un cliente de GoogleGenAI y devuelve una promesa con la respuesta.
 * @returns El resultado de la llamada a la API.
 * @throws Si todas las claves de API fallan o si ocurre un error no retriable.
 */
async function makeApiRequestWithRetry<T>(requestFn: (client: GoogleGenAI) => Promise<T>): Promise<T> {
    initializeApiKeyPool();

    if (apiKeyPool.length === 0 || (apiKeyPool.length === 1 && apiKeyPool[0].key.includes("YOUR_API_KEY_HERE"))) {
        logger.log('ERROR', 'geminiService', 'No hay claves de API válidas configuradas.');
        throw new Error("Clave de API inválida o de marcador de posición. Por favor, edita el archivo `config/secure_config.ts` y reemplaza 'YOUR_API_KEY_HERE_...' con tus claves reales de Google AI.");
    }

    const totalKeys = apiKeyPool.length;
    let attempts = 0;

    while (attempts < totalKeys) {
        const availableKey = getNextAvailableKey();
        
        if (!availableKey) {
            const poolStatus = apiKeyPool.map(k => `${k.maskedKey}: ${k.status}`).join(', ');
            logger.log('ERROR', 'geminiService', `No hay claves disponibles. Estado del pool: ${poolStatus}`);
            throw new Error(`Todas las claves de API están en cooldown o agotadas. Por favor, revisa las cuotas de tu proyecto de Google. Estado actual: ${poolStatus}`);
        }

        const { apiKey, index } = availableKey;
        attempts++;

        logger.log('DEBUG', 'geminiService', `Intento #${attempts}: Usando clave ${apiKey.maskedKey} (Índice ${index})`);
        
        try {
            const result = await requestFn(apiKey.client);
            logger.log('SUCCESS', 'geminiService', `Llamada a la API exitosa con la clave ${apiKey.maskedKey}`);
            currentKeyIndex = (index + 1) % totalKeys; // Mover a la siguiente clave para balanceo de carga.
            return result;
        } catch (error: any) {
            const errorMessage = error.toString().toLowerCase();
            logger.log('WARNING', 'geminiService', `Fallo con la clave ${apiKey.maskedKey}. Razón: ${errorMessage}`);
            
            // Distingue entre agotamiento de cuota diario y límite de tasa temporal.
            if (errorMessage.includes('daily limit')) {
                 logger.log('ERROR', 'geminiService', `La clave ${apiKey.maskedKey} ha alcanzado su LÍMITE DIARIO. Se marcará como agotada permanentemente para esta sesión.`);
                 apiKey.status = 'EXHAUSTED_QUOTA';
            } else if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
                logger.log('WARNING', 'geminiService', `La clave ${apiKey.maskedKey} alcanzó el límite de tasa. Poniendo en cooldown por 1 minuto.`);
                apiKey.status = 'COOLDOWN';
                apiKey.cooldownUntil = Date.now() + COOLDOWN_PERIOD;
            } else {
                logger.log('ERROR', 'geminiService', `Error no retriable con la clave ${apiKey.maskedKey}. Abortando.`, error);
                throw error; // Error no retriable (ej. 400 Bad Request), falla inmediatamente.
            }
            
            // Avanza al siguiente índice para el próximo intento en el bucle.
            currentKeyIndex = (index + 1) % totalKeys;
        }
    }

    const finalPoolStatus = apiKeyPool.map(k => `${k.maskedKey}: ${k.status}`).join('; ');
    logger.log('ERROR', 'geminiService', `Todos los ${totalKeys} intentos fallaron. Estado final del pool: ${finalPoolStatus}`);
    throw new Error(`Todas las claves de API (${totalKeys}) han fallado. Revisa las cuotas de tu proyecto de Google. Estado final del pool de claves: [${finalPoolStatus}]`);
}


// --- FUNCIONES DE SERVICIO PÚBLICAS (Sin cambios) ---

export async function assistConcept(idea: string): Promise<InitialConcept> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Basado en esta idea inicial: "${idea}", expande esto en un concepto estructurado. Genera una audiencia objetivo y 3-5 elementos clave.`,
            config: { responseMimeType: 'application/json' }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function suggestStyle(concept: InitialConcept): Promise<Partial<StyleAndFormat>> {
     const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Dada esta idea: ${JSON.stringify(concept)}, sugiere exactamente una opción para cada categoría: 'outputFormat', 'narrativeStyle', 'visualStyle', 'narrativeStructure', 'hook', 'conflict', 'ending' y un 'energyLevel' entre 1-10.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      outputFormat: { type: Type.ARRAY, items: { type: Type.STRING } },
                      narrativeStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
                      visualStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
                      narrativeStructure: { type: Type.ARRAY, items: { type: Type.STRING } },
                      hook: { type: Type.ARRAY, items: { type: Type.STRING } },
                      conflict: { type: Type.ARRAY, items: { type: Type.STRING } },
                      ending: { type: Type.ARRAY, items: { type: Type.STRING } },
                      energyLevel: { type: Type.INTEGER }
                    }
                }
            }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function assistCharacterDetails(character: CharacterDefinition, concept: InitialConcept): Promise<Partial<CharacterDefinition>> {
     const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Basado en el concepto ${JSON.stringify(concept)}, desarrolla este personaje: ${JSON.stringify(character)}. Completa los campos vacíos.`,
            config: { responseMimeType: 'application/json' }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function generateStoryStructure(concept: InitialConcept, characters: CharacterDefinition[]): Promise<StoryStructure> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Crea un resumen para una estructura de 3 actos para este concepto: ${JSON.stringify(concept)} con estos personajes: ${JSON.stringify(characters)}.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        act1_summary: { type: Type.STRING },
                        act2_summary: { type: Type.STRING },
                        act3_summary: { type: Type.STRING }
                    }
                }
            }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function runCoherenceAnalysis(concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[], structure: StoryStructure): Promise<StructuralCoherenceReport> {
    // Esta es una simulación. En un sistema real, esta lógica compleja podría residir aquí.
    await new Promise(res => setTimeout(res, 1500));
    return {
        coherenceScore: 8.7,
        overallAssessment: "La historia muestra una fuerte coherencia entre el concepto y los personajes. El estilo visual encaja bien con la narrativa.",
        checks: [
            { id: '1', element: "Conflicto del Personaje vs. Arco", concern: "El defecto del protagonista no está fuertemente conectado con el conflicto central del Acto 2.", suggestion: "Considera cómo su defecto principal podría ser la causa directa de un obstáculo clave en el segundo acto.", severity: 'medium' },
            { id: '2', element: "Estilo Visual vs. Tono", concern: "El estilo visual 'Cyberpunk Neón' puede chocar con el tono 'Contemplativo' si no se maneja con cuidado.", suggestion: "Usa el neón de forma selectiva para resaltar momentos de introspección en lugar de acción constante.", severity: 'low' }
        ]
    };
}

export async function generateStoryMasterplan(project: any): Promise<StoryMasterplan> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera un plan de historia maestro (StoryMasterplan) basado en el siguiente proyecto: ${JSON.stringify(project)}`,
            config: { responseMimeType: 'application/json' }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function critiqueAndEnrichMasterplan(plan: StoryMasterplan): Promise<Critique> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Realiza una crítica (Critique) de este plan maestro y enriquece sus elementos: ${JSON.stringify(plan)}`,
            config: { responseMimeType: 'application/json' }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function generateProductionDocuments(plan: StoryMasterplan): Promise<Documentation> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera los tres documentos de producción (aiProductionGuide, directorsBible, visualStyleGuide) para este plan: ${JSON.stringify(plan)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        aiProductionGuide: { type: Type.STRING },
                        directorsBible: { type: Type.STRING },
                        visualStyleGuide: { type: Type.STRING }
                    }
                }
            }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function generateHookMatrix(plan: StoryMasterplan): Promise<HookMatrix> {
    const responseText = await makeApiRequestWithRetry(async (client) => {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera una matriz de ganchos virales (HookMatrix) para este plan de historia: ${JSON.stringify(plan)}`,
            config: { responseMimeType: 'application/json' }
        });
        return response.text;
    });
    return parseJsonMarkdown(responseText);
}

export async function generateReferenceImage(asset: ReferenceAsset): Promise<Blob> {
    const response = await makeApiRequestWithRetry(async (client) => {
        const imageResponse: GoogleImagesResponse = await client.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: asset.visualPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png'
            },
        });
        const base64Image = imageResponse.generatedImages[0].image.imageBytes;
        const fetchResponse = await fetch(`data:image/png;base64,${base64Image}`);
        return fetchResponse.blob();
    });
    return response;
}


export async function generateVideoSegment(prompt: string, referenceImage?: File): Promise<string> {
    // Inicializar el pool antes de obtener la clave
    initializeApiKeyPool();
    
    let usedApiKey: string = '';
    const operation = await makeApiRequestWithRetry(async (client) => {
        const availableKey = getNextAvailableKey();
        if (!availableKey) throw new Error("No hay claves de API disponibles para iniciar la generación de video.");
        usedApiKey = availableKey.apiKey.key;
        const imagePart = referenceImage ? await fileToGenerativePart(referenceImage) : undefined;
        let op: GenerateVideosOperation = await client.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            ...(imagePart && { image: { imageBytes: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType } }),
            config: { numberOfVideos: 1 }
        });

        while (!op.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            const updatedOp: GenerateVideosOperation = await client.operations.getVideosOperation({ operation: op });
            op = updatedOp;
        }
        return op;
    });

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("La operación de video finalizó pero no se encontró ningún enlace de descarga.");
    }

    return `${downloadLink}&key=${usedApiKey}`;
}
