/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type, GenerateContentResponse, Operation } from "@google/genai";
import { 
    PersistentAPIKeyManager,
    type APIKeyData,
} from './persistentApiKeyManager';
import type { 
    StoryMasterplan, Critique, Documentation, ReferenceAssets, ReferenceAsset, ProgressUpdate,
    FinalAssets, AIRecommendation, StructuralCoherenceReport, HookMatrix, InitialConcept,
    StyleAndFormat, CharacterDefinition, StoryStructure, CoherenceCheckStep, CoherenceCheckItem,
    CharacterRelationship, ExportedProject, CharacterMotivation
} from '../components/story-builder/types';
import { 
    StructuralCoherenceReportSchema, AIStyleSuggestionSchema, AICharacterDetailsSchema,
    AIStoryStructureSchema, CoherenceCheckItemsSchema, StoryMasterplanSchema, InitialConceptSchema,
} from '../components/story-builder/types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from '../components/story-builder/constants';
import { fileToGenerativePart } from "../utils/fileUtils";
import { parseJsonMarkdown } from "../utils/parserUtils";
import { assetDBService } from "./assetDBService";
import { logger } from '../utils/logger';
import { formatApiError } from '../utils/errorUtils';
import { z } from "zod";
import geminiWebService from './geminiWebService';
import { workerGemini } from './workerGeminiManager';
import { iframeGemini } from './iframeGeminiManager';
import { API_KEYS } from '../config/secure_config';

// ====================================================================================
// API INSTANCE CACHING
// ====================================================================================
const aiInstances = new Map<string, GoogleGenAI>();

function getAiInstance(apiKey: string): GoogleGenAI {
    if (!aiInstances.has(apiKey)) {
        if (!apiKey || apiKey.startsWith('YOUR_API_KEY_HERE')) {
            throw new Error("Attempted to use an invalid or placeholder API key.");
        }
        aiInstances.set(apiKey, new GoogleGenAI({ apiKey }));
    }
    return aiInstances.get(apiKey)!;
}

// ====================================================================================
// GLOBAL REQUEST QUEUE & RATE LIMITER
// ====================================================================================
const requestQueue: { task: () => Promise<any>; resolve: (value: any) => void; reject: (reason?: any) => void; }[] = [];
let isProcessingQueue = false;
const MIN_REQUEST_INTERVAL = 1200; // ~50 RPM for safety

const processQueue = async () => {
    if (requestQueue.length === 0 || isProcessingQueue) return;
    isProcessingQueue = true;

    const { task, resolve, reject } = requestQueue.shift()!;
    try {
        const result = await task();
        resolve(result);
    } catch (error) {
        reject(error);
    }

    setTimeout(() => {
        isProcessingQueue = false;
        processQueue();
    }, MIN_REQUEST_INTERVAL);
};

const scheduleApiRequest = <T>(task: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        requestQueue.push({ task, resolve, reject });
        if (!isProcessingQueue) {
            processQueue();
        }
    });
};

// ====================================================================================
// API KEY ROTATION LOGIC
// ====================================================================================

async function makeApiRequestWithRotation<T>(
    requestFn: (keyData: APIKeyData) => Promise<T>,
    remainingKeys: APIKeyData[] | null = null
): Promise<T> {
    const keysToTry = remainingKeys ?? PersistentAPIKeyManager.getAvailableKeys();
    if (keysToTry.length === 0) {
        logger.log('ERROR', 'geminiService', 'All API keys are exhausted or misconfigured.');
        throw new Error("All API keys have reached their quota or are invalid. Please add more keys in `config/secure_config.ts` or wait for the cooldown period.");
    }

    const currentKey = keysToTry[0];
    const nextKeys = keysToTry.slice(1);

    try {
        logger.log('INFO', 'geminiService', `Attempting API call with key: ${currentKey.projectName}`);
        const result = await requestFn(currentKey);
        PersistentAPIKeyManager.markAsSuccessful(currentKey.id);
        return result;
    } catch (error: any) {
        const errorMessage = (error.message || '').toLowerCase();
        if (errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('resource_exhausted') || errorMessage.includes('api key not valid')) {
            const reason = errorMessage.includes('api key not valid') ? 'Invalid' : 'Quota Exceeded';
            logger.log('WARNING', 'geminiService', `Key ${currentKey.projectName} failed (${reason}). Rotating to next key.`);
            PersistentAPIKeyManager.markAsExhausted(currentKey.id, error.message);
            return makeApiRequestWithRotation(requestFn, nextKeys);
        } else {
            logger.log('ERROR', 'geminiService', `Non-quota error with key ${currentKey.projectName}. Aborting rotation.`, error);
            throw error; // Rethrow non-quota errors
        }
    }
}


// ====================================================================================
// ISOLATION & FALLBACK STRATEGY (WRAPPED WITH ROTATION)
// ====================================================================================
function apiResponseToText(response: any): string {
  return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function _performSingleApiAttempt(
  params: any,
  keyData: APIKeyData
): Promise<GenerateContentResponse> {
    const { model, contents, config } = params;
    
    // Transform the SDK's 'config' object into a REST API-compliant body
    // for direct fetch calls in the worker/iframe.
    const { systemInstruction, ...generationConfig } = config || {};
    const requestBody: any = {};
    
    if (systemInstruction) {
        requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    
    if (Object.keys(generationConfig).length > 0) {
        requestBody.generationConfig = generationConfig;
    }
    
    // Structure the 'contents' part of the request body
    if (typeof contents === 'string') {
        requestBody.contents = [{ parts: [{ text: contents }] }];
    } else if (contents.parts) {
        requestBody.contents = [contents];
    } else {
        requestBody.contents = contents;
    }

    const apiKey = keyData.api_key;
    if (!apiKey) throw new Error("API key is missing.");
    
    // 1. Try Worker
    if (workerGemini.isReady()) {
      try {
        logger.log('DEBUG', 'geminiService', `Attempting call with Worker (${keyData.projectName})`);
        const result = await workerGemini.generateContent(apiKey, model, requestBody);
        const text = apiResponseToText(result);
        if (!text && (result.error || result.message)) throw new Error(result.error || result.message);
        if (!text && !result.candidates) throw new Error("Worker returned an invalid or empty response.");
        logger.log('SUCCESS', 'geminiService', `✅ Worker call successful with ${keyData.projectName}`);
        return { text } as GenerateContentResponse;
      } catch (workerError: any) {
        logger.log('DEBUG', 'geminiService', `Worker failed (${keyData.projectName}): ${workerError.message}. Trying iframe.`);
        // If it's a quota error, it needs to be thrown to be caught by the rotator
        if (workerError.message.toLowerCase().includes('quota') || workerError.message.includes('429')) {
            throw workerError;
        }
      }
    }

    // 2. Try Iframe
    try {
      logger.log('DEBUG', 'geminiService', `Attempting call with Iframe (${keyData.projectName})`);
      const result = await iframeGemini.generateContent(apiKey, model, requestBody);
      const text = apiResponseToText(result);
      if (!text && (result.error || result.message)) throw new Error(result.error || result.message);
      if (!text && !result.candidates) throw new Error("Iframe returned an invalid or empty response.");
      logger.log('SUCCESS', 'geminiService', `✅ Iframe call successful with ${keyData.projectName}`);
      return { text } as GenerateContentResponse;
    } catch (iframeError: any) {
      logger.log('DEBUG', 'geminiService', `Iframe failed (${keyData.projectName}): ${iframeError.message}. Trying SDK.`);
       if (iframeError.message.toLowerCase().includes('quota') || iframeError.message.includes('429')) {
            throw iframeError;
        }
    }

    // 3. Fallback to SDK
    logger.log('DEBUG', 'geminiService', `Attempting call with SDK (${keyData.projectName})`);
    const aiInstance = getAiInstance(apiKey);
    // The SDK expects the original `params` object, not the transformed one.
    return aiInstance.models.generateContent(params);
}

/**
 * The main entry point for making a `generateContent` API call.
 * This function acts as a gatekeeper to prevent calls with invalid keys,
 * then handles API key rotation and isolation fallbacks.
 */
function generateContent(params: any): Promise<GenerateContentResponse> {
    // GATEKEEPER: Check for configured keys *before* doing anything else.
    const configuredKeys = API_KEYS.filter(k => k.api_key && !k.api_key.startsWith('YOUR_API_KEY_HERE'));
    if (configuredKeys.length === 0) {
        logger.log('ERROR', 'geminiService', 'API call blocked: No valid API keys are configured in config/secure_config.ts.');
        // This specific error message is caught by `formatApiError` to give the user a helpful alert.
        return Promise.reject(new Error("Attempted to use an invalid or placeholder API key."));
    }

    // If keys exist, proceed with the original logic.
    const requestFn = (keyData: APIKeyData) => scheduleApiRequest(() => _performSingleApiAttempt(params, keyData));
    return makeApiRequestWithRotation(requestFn);
}


// ====================================================================================
// AGENT SWARM ARCHITECTURE - REFACTORED FOR SIMPLICITY AND ROBUSTNESS
// ====================================================================================

// Schemas for robust JSON responses
const InitialConceptResponseSchema = {
    type: Type.OBJECT,
    properties: {
        idea: { type: Type.STRING },
        targetAudience: { type: Type.STRING },
        keyElements: { type: Type.ARRAY, items: { type: Type.STRING } },
        logline: { type: Type.STRING }
    },
    required: ['idea', 'targetAudience', 'keyElements', 'logline']
};

const StringArrayResponseSchema = { type: Type.ARRAY, items: { type: Type.STRING } };

const StyleSynthResponseSchema = {
    type: Type.OBJECT,
    properties: {
        outputFormat: { type: Type.ARRAY, items: { type: Type.STRING } },
        narrativeStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
        visualStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
        styleNotesSuggestion: { type: Type.STRING },
    },
    required: ['outputFormat', 'narrativeStyle', 'visualStyle', 'styleNotesSuggestion']
};

const MotivationResponseSchema = {
    type: Type.OBJECT, properties: { desire: { type: Type.STRING }, fear: { type: Type.STRING }, need: { type: Type.STRING }, },
    required: ['desire', 'fear', 'need']
};

const FlawArcResponseSchema = {
    type: Type.OBJECT, properties: { flaw: { type: Type.STRING }, arc: { type: Type.STRING }, },
    required: ['flaw', 'arc']
};

const VisualsResponseSchema = {
    type: Type.OBJECT, properties: { description: { type: Type.STRING }, visual_prompt_enhancers: { type: Type.ARRAY, items: { type: Type.STRING } }, },
    required: ['description', 'visual_prompt_enhancers']
};

const CharacterSynthResponseSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING },
        motivation: MotivationResponseSchema,
        flaw: { type: Type.STRING },
        arc: { type: Type.STRING },
        visual_prompt_enhancers: { type: Type.STRING },
    },
    required: ['description', 'motivation', 'flaw', 'arc', 'visual_prompt_enhancers']
};


const agent_generateLogline = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un guionista experto. Dada una idea, escribe una logline concisa y atractiva (1-2 frases). Responde solo con el texto de la logline.";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } });
};

const agent_identifyThemes = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un analista literario. Dada una idea, extrae 3-5 temas o palabras clave principales. Responde con una lista separada por comas (ej: 'sacrificio, tecnología, naturaleza').";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } });
};

const agent_suggestAudience = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un estratega de marketing. Dada una idea, define el público objetivo ideal en una frase corta. (ej: 'Jóvenes adultos interesados en la ciencia ficción distópica').";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } });
};

const synthesizer_concept = (idea: string, logline: string, themes: string, audience: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un Agente Sintetizador de Conceptos. Tu trabajo es tomar la idea original y los elementos generados por otros agentes y combinarlos en un objeto JSON coherente y mejorado. Si los elementos no son coherentes, ajústalos. La respuesta DEBE ser un único objeto JSON válido con las claves 'idea', 'targetAudience', 'keyElements' y 'logline'. La respuesta debe estar en español.";
    const prompt = `Idea Original: "${idea}"\nLogline Propuesta: "${logline}"\nTemas Propuestos: "${themes}"\nPúblico Propuesto: "${audience}"\n\nSintetiza y refina estos elementos en un objeto JSON final.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: InitialConceptResponseSchema } });
};

const agent_suggestOutputFormats = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(outputFormats).flat().map(o => o.name);
    const systemInstruction = `Eres un productor de medios. Basado en el concepto, sugiere los 3 formatos de salida más efectivos de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json', responseSchema: StringArrayResponseSchema } });
};

const agent_suggestNarrativeStyles = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(narrativeStyles).flat().map(o => o.name);
    const systemInstruction = `Eres un guionista. Basado en el concepto, sugiere los 3 estilos narrativos más adecuados de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json', responseSchema: StringArrayResponseSchema } });
};

const agent_suggestVisualStyles = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(visualStyles).flat().map(o => o.name);
    const systemInstruction = `Eres un director de arte. Basado en el concepto, sugiere los 3 estilos visuales más impactantes de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json', responseSchema: StringArrayResponseSchema } });
};

const synthesizer_style = (concept: InitialConcept, formatSuggestions: any, narrativeSuggestions: any, visualSuggestions: any): Promise<GenerateContentResponse> => {
    const systemInstruction = `Eres un 'Sintetizador Creativo'. Tu tarea es asegurar la coherencia. Analiza las sugerencias de estilo, formato y visuales en relación con el concepto. Si son incoherentes (ej. 'Cartoon' visual con 'Hiperrealista' narrativo), elige la combinación más lógica. Luego, escribe una 'styleNotesSuggestion' de 1-2 frases que resuma la dirección creativa. Tu respuesta DEBE ser un objeto JSON válido con las claves 'outputFormat', 'narrativeStyle', 'visualStyle', y 'styleNotesSuggestion'. La respuesta debe estar en español.`;
    const prompt = `Concepto: ${JSON.stringify(concept)}\nSugerencias de Formato: ${JSON.stringify(formatSuggestions)}\nSugerencias Narrativas: ${JSON.stringify(narrativeSuggestions)}\nSugerencias Visuales: ${JSON.stringify(visualSuggestions)}\n\nSintetiza, asegura la coherencia y genera la nota de estilo.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: StyleSynthResponseSchema } });
};

const agent_generateMotivation = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un escritor de personajes. Genera la motivación del personaje (desire, fear, need) basándote en su información. Responde con un objeto JSON con esas tres claves.";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: MotivationResponseSchema } });
};

const agent_generateFlawAndArc = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un escritor de personajes. Genera un defecto crítico ('flaw') y un arco de transformación ('arc') para el personaje. Responde con un objeto JSON con esas dos claves.";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: FlawArcResponseSchema } });
};

const agent_generateVisuals = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un diseñador de personajes. Escribe una 'description' visual detallada y 3-5 'visual_prompt_enhancers' (palabras clave para IA) para este personaje. Responde con un objeto JSON con esas dos claves.";
    return generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: VisualsResponseSchema } });
};

const synthesizer_character = (context: any, character: Partial<CharacterDefinition>, motivation: any, flawArc: any, visuals: any): Promise<GenerateContentResponse> => {
    const systemInstruction = `Eres un 'Sintetizador de Personajes'. Tu tarea es combinar todos los elementos generados en un perfil de personaje coherente. Asegúrate de que la motivación, el defecto, el arco y la descripción visual se alineen. Refina la descripción general para que refleje todos los aspectos. Tu respuesta DEBE ser un objeto JSON válido con las claves 'description', 'motivation', 'flaw', 'arc', y 'visual_prompt_enhancers'. La respuesta debe estar en español.`;
    const prompt = `Contexto: ${JSON.stringify(context)}\nPersonaje Base: ${JSON.stringify(character)}\nMotivación: ${JSON.stringify(motivation)}\nDefecto y Arco: ${JSON.stringify(flawArc)}\nVisuales: ${JSON.stringify(visuals)}\n\nSintetiza en un perfil de personaje final y coherente.`;
    return generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json', responseSchema: CharacterSynthResponseSchema } });
};

export const orchestrateConceptGeneration = async (idea: string, existingConcept: InitialConcept | null): Promise<InitialConcept> => {
    const finalIdea = existingConcept?.idea || idea;
    const [loglineRes, themesRes, audienceRes] = await Promise.all([
        agent_generateLogline(finalIdea),
        agent_identifyThemes(finalIdea),
        agent_suggestAudience(finalIdea)
    ]) as GenerateContentResponse[];

    const synthResponse: GenerateContentResponse = await synthesizer_concept(finalIdea, loglineRes.text, themesRes.text, audienceRes.text);
    const parsedJson = parseJsonMarkdown(synthResponse.text);
    return InitialConceptSchema.parse({
        ...existingConcept,
        ...parsedJson,
        idea: finalIdea,
    }) as InitialConcept;
};

export const orchestrateStyleGeneration = async (concept: InitialConcept): Promise<Partial<StyleAndFormat>> => {
    const [formatsRes, narrativeRes, visualRes] = await Promise.all([
        agent_suggestOutputFormats(concept),
        agent_suggestNarrativeStyles(concept),
        agent_suggestVisualStyles(concept)
    ]) as GenerateContentResponse[];
    
    const synthResponse: GenerateContentResponse = await synthesizer_style(concept, parseJsonMarkdown(formatsRes.text), parseJsonMarkdown(narrativeRes.text), parseJsonMarkdown(visualRes.text));
    const parsedJson = parseJsonMarkdown(synthResponse.text);
    return AIStyleSuggestionSchema.parse(parsedJson);
};


export const orchestrateCharacterGeneration = async (context: { concept: InitialConcept, style: StyleAndFormat }, character: Partial<CharacterDefinition>): Promise<Partial<CharacterDefinition>> => {
    const [motivationRes, flawArcRes, visualsRes] = await Promise.all([
        agent_generateMotivation(context, character),
        agent_generateFlawAndArc(context, character),
        agent_generateVisuals(context, character)
    ]) as GenerateContentResponse[];

    const synthResponse: GenerateContentResponse = await synthesizer_character(context, character, parseJsonMarkdown(motivationRes.text), parseJsonMarkdown(flawArcRes.text), parseJsonMarkdown(visualsRes.text));
    const parsedJson = parseJsonMarkdown(synthResponse.text);
    return AICharacterDetailsSchema.parse(parsedJson);
};

// ====================================================================================
// PHOTO EDITOR & STORY BUILDER SERVICES (WITH ROTATION)
// ====================================================================================
interface GenerateImagesResponse { generatedImages: Array<{ image: { imageBytes: string; }; }>; }

export async function generateImageWithFallback(prompt: string): Promise<Blob> {
    logger.log('INFO', 'geminiService', `Generating image with SDK rotation...`);
    try {
        const requestFn = (keyData: APIKeyData) => {
            const aiInstance = getAiInstance(keyData.api_key);
            return scheduleApiRequest(() =>
                aiInstance.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: prompt,
                    config: { numberOfImages: 1, aspectRatio: '1:1' }
                })
            );
        };
        const result = await makeApiRequestWithRotation(requestFn) as GenerateImagesResponse;

        const base64Data = result.generatedImages[0].image.imageBytes;
        return await (await fetch(`data:image/jpeg;base64,${base64Data}`)).blob();
    } catch (apiError: any) {
        logger.log('WARNING', 'geminiService', 'Image generation with all API keys failed, trying Gemini Web fallback.', formatApiError(apiError));
        
        if (geminiWebService.isInitialized()) {
            try {
                logger.log('INFO', 'geminiService', `Attempting image generation with Web Fallback: "${prompt.substring(0, 50)}..."`);
                return await geminiWebService.generateImage(prompt);
            } catch (webError: any) {
                logger.log('ERROR', 'geminiService', 'Gemini Web fallback also failed.', formatApiError(webError));
                throw new Error(`All generation methods failed. API Error: ${formatApiError(apiError)}. Web Error: ${formatApiError(webError)}`);
            }
        } else {
            logger.log('ERROR', 'geminiService', 'Fallback unavailable, Gemini Web is not connected.');
            throw new Error(`All API keys failed and the unlimited generation mode (fallback) is not connected. ${formatApiError(apiError)}`);
        }
    }
}


export async function editImageWithMask(
    baseImage: File,
    maskImage: File,
    prompt: string,
    referenceImage?: File | null
): Promise<Blob> {
    const requestFn = async (keyData: APIKeyData): Promise<GenerateContentResponse> => {
        const aiInstance = getAiInstance(keyData.api_key);
        const baseImagePart = await fileToGenerativePart(baseImage);
        const maskImagePart = await fileToGenerativePart(maskImage, "image/png");

        const contents: any[] = [ { text: prompt }, baseImagePart, maskImagePart ];
        if (referenceImage) {
            contents.push(await fileToGenerativePart(referenceImage));
        }

        return scheduleApiRequest(() =>
            aiInstance.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: contents },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
            })
        );
    };

    const result = await makeApiRequestWithRotation(requestFn);
    
    const imagePart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("No image was generated by the API.");
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;
    return await (await fetch(`data:${mimeType};base64,${base64Data}`)).blob();
}

export async function enhanceCreativePrompt(prompt: string): Promise<string> {
    const systemInstruction = `Eres un asistente de IA especializado en la creación de prompts para la generación de imágenes fotorrealistas. Tu tarea es mejorar y enriquecer los prompts del usuario para obtener los mejores resultados posibles. La respuesta DEBE estar en español.`;
    const result: GenerateContentResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: `Mejora este prompt: "${prompt}"`,
        config: { systemInstruction }
    });
    return result.text.trim();
}

export async function generatePhotoshootImages(
    subjectImage: File,
    scenePrompt: string,
    numImages: number,
    sceneImage?: File | null
): Promise<Blob[]> {
    logger.log('INFO', 'geminiService', `Generating ${numImages} photoshoot images...`);
    // This function now automatically benefits from the fallback logic in generateImageWithFallback
    const imagePromises = Array(numImages).fill(0).map(() => generateImageWithFallback(scenePrompt));
    return Promise.all(imagePromises);
}

export async function getAIRecommendations(image: File, presets: any[], context: string): Promise<AIRecommendation[]> {
    const systemInstruction = "Eres un experto editor de fotos IA. Analiza la imagen y recomienda los 5 mejores ajustes preestablecidos de la lista proporcionada que mejorarían la foto, basándote en el contexto del usuario. Para cada recomendación, proporciona el nombre exacto del preestablecido, una razón concisa y una puntuación de confianza. También puedes sugerir un ajuste de balance de color si es necesario. Tu respuesta DEBE ser un objeto JSON válido.";
    const imagePart = await fileToGenerativePart(image);
    const prompt = `Contexto: "${context || 'Mejora general'}". Preestablecidos: ${JSON.stringify(presets.map(p => p.name))}. Analiza y recomienda. La respuesta DEBE estar en español.`;

    const result: GenerateContentResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{text: prompt}, imagePart] },
        config: { systemInstruction, responseMimeType: 'application/json' }
    });
    return parseJsonMarkdown(result.text);
}

export async function getAIFilterRecommendations(image: File, presets: any[], context: string): Promise<{ presetName: string, reason: string }[]> {
    const systemInstruction = "Eres un director creativo IA. Analiza la imagen y recomienda los 5 mejores filtros de la lista proporcionada que encajarían estilísticamente, basándote en el contexto del usuario. Para cada recomendación, proporciona el nombre exacto del filtro y una razón concisa. Tu respuesta DEBE ser un objeto JSON válido.";
    const imagePart = await fileToGenerativePart(image);
    const prompt = `Contexto: "${context || 'Aplicar un filtro creativo'}". Filtros: ${JSON.stringify(presets.map(p => p.name))}. Analiza y recomienda. La respuesta DEBE estar en español.`;

    const result: GenerateContentResponse = await generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{text: prompt}, imagePart] },
        config: { systemInstruction, responseMimeType: 'application/json' }
    });
    return parseJsonMarkdown(result.text);
}

interface GenerateVideosResponse { generatedVideos?: Array<{ video?: { uri?: string; }; }>; }

const agent_analyzeOverallConcept = async (userInput: any): Promise<{ assessment: string; score: number }> => {
    const systemInstruction = `Eres un agente "Asesor de Concepto de Historia". Tu tarea es proporcionar una evaluación de alto nivel y una puntuación de coherencia (0-10) para el concepto de historia del usuario, basándote en todas las entradas proporcionadas. Tu respuesta DEBE ser un único objeto JSON válido con las claves "assessment" y "score". La respuesta debe estar en español.`;
    const result = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text);
};

const agent_analyzeConsistency = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un agente "Verificador de Consistencia". Analiza las entradas del usuario en busca de contradicciones entre estilo, personajes y trama. Identifica posibles agujeros en la trama. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } });
    return CoherenceCheckItemsSchema.parse(parseJsonMarkdown(result.text));
};

const agent_analyzePacingAndStructure = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un agente de "Ritmo y Estructura". Analiza si la estructura de 3 actos tiene un buen ritmo y es adecuada para el formato de salida elegido. Identifica debilidades en el flujo narrativo. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } });
    return CoherenceCheckItemsSchema.parse(parseJsonMarkdown(result.text));
};

const agent_analyzeCharacterArcs = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un "Analista de Arcos de Personajes". Analiza si las motivaciones, defectos y arcos de los personajes son convincentes y coherentes con el tema de la historia. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } });
    return CoherenceCheckItemsSchema.parse(parseJsonMarkdown(result.text));
};

export const runStructuralCoherenceCheck = async (userInput: any, onProgress: (update: CoherenceCheckStep) => void): Promise<StructuralCoherenceReport> => {
    onProgress({ id: 'concept', label: 'Analizando Concepto General', status: 'running' });
    const conceptResult = await agent_analyzeOverallConcept(userInput);
    onProgress({ id: 'concept', label: 'Análisis de Concepto General', status: 'complete', result: `Puntuación: ${conceptResult.score}/10` });

    onProgress({ id: 'consistency', label: 'Verificando Consistencia', status: 'running' });
    const consistencyResult = await agent_analyzeConsistency(userInput);
    onProgress({ id: 'consistency', label: 'Verificación de Consistencia', status: 'complete', result: `${consistencyResult.length} problemas encontrados.` });
    
    onProgress({ id: 'pacing', label: 'Evaluando Ritmo y Estructura', status: 'running' });
    const pacingResult = await agent_analyzePacingAndStructure(userInput);
    onProgress({ id: 'pacing', label: 'Evaluación de Ritmo y Estructura', status: 'complete', result: `${pacingResult.length} problemas encontrados.` });

    onProgress({ id: 'arcs', label: 'Analizando Arcos de Personajes', status: 'running' });
    const arcsResult = await agent_analyzeCharacterArcs(userInput);
    onProgress({ id: 'arcs', label: 'Análisis de Arcos de Personajes', status: 'complete', result: `${arcsResult.length} problemas encontrados.` });

    const finalReport = {
        overallAssessment: conceptResult.assessment,
        coherenceScore: conceptResult.score,
        checks: [...consistencyResult, ...pacingResult, ...arcsResult]
    };
    return StructuralCoherenceReportSchema.parse(finalReport);
};

export const generateStoryMasterplan = async (userInput: any): Promise<StoryMasterplan> => {
    const systemInstruction = `Eres un maestro narrador y director creativo. Tu tarea es sintetizar las entradas del usuario en un "Story Masterplan" coherente y altamente creativo en formato JSON. Asegúrate de que CADA escena en el 'narrative_arc' incluya un campo 'visual_elements_prompt', que es un prompt detallado para un generador de video AI. La respuesta DEBE estar en español y ser un único objeto JSON válido.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } });
    return StoryMasterplanSchema.parse(parseJsonMarkdown(result.text));
};

export const critiqueStoryMasterplan = async (plan: StoryMasterplan): Promise<Critique> => {
    const systemInstruction = `Eres un editor de historias profesional y un experto en marketing viral. Tu análisis debe ser agudo y enfocado en maximizar el potencial de la historia. Proporciona tu feedback en un objeto JSON válido en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text);
};

export const applyCritiqueToMasterplan = async (plan: StoryMasterplan): Promise<StoryMasterplan> => {
    const systemInstruction = `Eres un "script doctor" IA. Tu tarea es reescribir y mejorar un plan de historia existente basándote en la crítica proporcionada. Integra las sugerencias de forma creativa. La salida debe ser un único objeto JSON válido con la estructura del "Story Masterplan" mejorado y en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text);
};

export const generateProductionBible = async (plan: StoryMasterplan): Promise<Documentation> => {
    const systemInstruction = `Eres un asistente de producción IA. Basándote en el "Story Masterplan", genera una "Biblia de Producción" que incluya: "Guía del Director", "Guía de Producción para IA", y "Guía de Estilo Visual". La salida debe ser un único objeto JSON válido en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text);
};

export const generateHookMatrix = async (plan: StoryMasterplan): Promise<HookMatrix> => {
    const systemInstruction = `Eres un Agente Adaptador de Ganchos "Scroll-Stopper". Analiza el "Story Masterplan" y genera una "Matriz de Ganchos" en formato JSON. Para CADA una de las 5 categorías (patternInterrupts, psychologicalTriggers, curiosityGaps, powerPhrases, provenStructures), DEBES generar exactamente 10 plantillas de ganchos únicas y creativas. Cada plantilla debe incluir una 'rationale'. La respuesta DEBE estar en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text);
};

export const generateReferenceAssets = async (plan: StoryMasterplan, onProgress: (update: ProgressUpdate) => void): Promise<ReferenceAssets> => {
    const assetsToGenerate: Omit<ReferenceAsset, 'assetId'>[] = plan.characters.map(char => ({ id: `character_${char.name.toLowerCase().replace(/\s+/g, '_')}`, type: 'character', name: char.name, description: char.description, visualPrompt: char.visual_description, }));
    const generatedAssets: ReferenceAssets = { characters: [], environments: [], elements: [] };
    for (let i = 0; i < assetsToGenerate.length; i++) {
        const asset = assetsToGenerate[i];
        onProgress({ stage: 'reference_assets', status: 'in_progress', message: `Generando ${asset.type}: ${asset.name}...`, progress: ((i + 1) / assetsToGenerate.length) * 100 });
        const blob = await generateImageWithFallback(asset.visualPrompt);
        const assetId = `${asset.id}_${Date.now()}`;
        await assetDBService.saveAsset(assetId, blob);
        const completedAsset: ReferenceAsset = { ...asset, assetId };
        if (asset.type === 'character') generatedAssets.characters.push(completedAsset);
    }
    return generatedAssets;
};

export const regenerateSingleReferenceAsset = async (asset: ReferenceAsset): Promise<ReferenceAsset> => {
    const blob = await generateImageWithFallback(asset.visualPrompt);
    const assetId = `${asset.id}_${Date.now()}`;
    await assetDBService.saveAsset(assetId, blob);
    return { ...asset, assetId, generationStatus: 'completed' };
};

export const generateVideoAssets = async (plan: StoryMasterplan, references: ReferenceAssets, onProgress: (update: ProgressUpdate) => void): Promise<FinalAssets> => {
    logger.log('INFO', 'geminiService', 'Starting sequential video generation pipeline.');
    
    const allScenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);
    if (!allScenes || allScenes.length === 0) throw new Error("No scenes found in story plan to generate videos.");
    
    const finalAssets: FinalAssets = { videoAssets: [] };

    for (const scene of allScenes) {
        const sceneId = `scene_${scene.scene_number}`;
        const progressMessage = `Generando video ${finalAssets.videoAssets.length + 1}/${allScenes.length}: Escena ${scene.scene_number}`;
        onProgress({ stage: 'videos', status: 'in_progress', message: progressMessage, sceneId });

        const prompt = scene.visual_elements_prompt || `Un clip de video de: ${scene.summary}`;
        
        const requestFn = async (keyData: APIKeyData): Promise<Operation<GenerateVideosResponse>> => {
            const aiInstance = getAiInstance(keyData.api_key);
            return scheduleApiRequest(() =>
                aiInstance.models.generateVideos({ model: 'veo-2.0-generate-001', prompt: prompt, config: { numberOfVideos: 1 } })
            );
        };
        let operation = await makeApiRequestWithRotation(requestFn);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const pollFn = async (keyData: APIKeyData): Promise<Operation<GenerateVideosResponse>> => {
                 const aiInstance = getAiInstance(keyData.api_key);
                 return scheduleApiRequest(() => aiInstance.operations.getVideosOperation({ operation }));
            };
            operation = await makeApiRequestWithRotation(pollFn);
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error(`Could not get download link for Scene ${scene.scene_number}.`);
        }
        
        // The download link requires a key, but we need to find which key succeeded.
        // For simplicity, we'll try the first available key. This is a limitation of the current design.
        const downloadKey = PersistentAPIKeyManager.getAvailableKeys()[0]?.api_key;
        if (!downloadKey) {
             throw new Error("No available API key to download the generated video.");
        }

        const response = await fetch(`${downloadLink}&key=${downloadKey}`);
        const blob = await response.blob();
        const assetId = `video_${sceneId}_${Date.now()}`;
        await assetDBService.saveAsset(assetId, blob);
        finalAssets.videoAssets.push({ sceneId, segment: 1, totalSegments: 1, assetId });
    }
    return finalAssets;
};


export const suggestCharacterRelationships = async (characters: CharacterDefinition[]): Promise<CharacterDefinition[]> => {
    if (characters.length < 2) return characters;
    const systemInstruction = `Eres un dramaturgo IA. Analiza la lista de personajes. Propón una red de relaciones interesantes. Actualiza el campo 'relationships'. No elimines relaciones existentes. Tu respuesta DEBE ser el array completo de personajes actualizado, en formato JSON y en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(characters), config: { systemInstruction, responseMimeType: 'application/json' } });
    return parseJsonMarkdown(result.text) as CharacterDefinition[];
};

export const generateOrImproveStoryStructure = async (context: any, existingStructure: StoryStructure): Promise<StoryStructure> => {
    const systemInstruction = `Eres un guionista profesional de IA. Genera o mejora el resumen de la estructura de tres actos. Si los resúmenes están vacíos, créalos. Si tienen contenido, mejóralos. El tono debe ser creativo. Tu respuesta DEBE ser un objeto JSON válido con 'act1_summary', 'act2_summary' y 'act3_summary' en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nEstructura Existente: ${JSON.stringify(existingStructure)}`, config: { systemInstruction, responseMimeType: 'application/json' } });
    return AIStoryStructureSchema.parse(parseJsonMarkdown(result.text)) as StoryStructure;
};

export const applyCoherenceFixes = async (storyData: any, selectedSuggestions: CoherenceCheckItem[]): Promise<Partial<ExportedProject>> => {
    const systemInstruction = `Eres un "Agente Refinador y Expansor" de IA. Reescribe y mejora los datos de una historia basándote en una lista de sugerencias. Enriquece los resúmenes de los actos para que sean más detallados y cinematográficos. Devuelve la estructura de datos COMPLETA y actualizada en un único objeto JSON en español.`;
    const result: GenerateContentResponse = await generateContent({ model: 'gemini-2.5-flash', contents: `DATOS ORIGINALES:${JSON.stringify(storyData)}\nSUGERENCIAS:${JSON.stringify(selectedSuggestions)}`, config: { systemInstruction, responseMimeType: 'application/json' } });
    const RefinedDataSchema = z.object({ initialConcept: z.any().optional(), styleAndFormat: z.any().optional(), characters: z.array(z.any()).optional(), storyStructure: z.any().optional() }).partial();
    return RefinedDataSchema.parse(parseJsonMarkdown(result.text));
}