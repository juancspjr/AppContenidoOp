/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality, Type, GenerateContentResponse, Operation } from "@google/genai";
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
import { PersistentAPIKeyManager } from './apiKeyBlacklist';
import type { APIKeyStatus } from './apiKeyBlacklist';
import { z } from "zod";
// FIX: Changed import to default import as geminiWebService is exported as default.
import geminiWebService from './geminiWebService';

// ====================================================================================
// ⚠️ SIMULACIÓN DE BACKEND SEGURO ⚠️
// ====================================================================================
const GEMINI_API_KEYS = [
    { id: 'key_01', api_key: 'AIzaSyAtKX8NRdbO_0CrVCTAwD0eVKfe-AAt8j8', projectName: 'Project-Alpha' },
    { id: 'key_02', api_key: 'AIzaSyBm09YMD8vI97ZJ62BWv-4YWWmu87HsHG8', projectName: 'Project-Beta' },
    { id: 'key_03', api_key: 'AIzaSyDqzJir5JkKnI1RvXfqMBROFJzGJbCGlV4', projectName: 'Project-Gamma' },
    { id: 'key_04', api_key: 'AIzaSyBfVu-tILDX3x5TqviGpDohhjqJOhQ0szk', projectName: 'Project-Delta' },
    { id: 'key_05', api_key: 'AIzaSyDVgLT23C22qV4vMMVaQm8vZz_NBj7Skn0', projectName: 'Project-Epsilon' },
    { id: 'key_06', api_key: 'AIzaSyBdT5b7fYwmod6F0bkDySW48kEe8pMsqIk', projectName: 'Project-Zeta' },
    { id: 'key_07', api_key: 'AIzaSyAZHb4qKtWtwQoVt9LHDSPWgUKVeUt_XMM', projectName: 'Project-Eta' },
    { id: 'key_08', api_key: 'AIzaSyB6hLW1DHlpDEZviszXECxNWu4i7MaxH2o', projectName: 'Project-Theta' },
    { id: 'key_09', api_key: 'AIzaSyC5tu2VNwIbtqRyctGBpEBxoFhP5XuxP0o', projectName: 'Project-Iota' },
    { id: 'key_10', api_key: 'AIzaSyDMPzwkMdcW1lifMir3rZXZmhQ6xRYabVc', projectName: 'Project-Kappa' },
];

// ====================================================================================
// FACHADA DE GESTIÓN DE API PARA LA UI
// ====================================================================================
export const resetAllAPIs = (): void => PersistentAPIKeyManager.resetAllAPIs();
export const resetSpecificAPI = (projectName: string): void => PersistentAPIKeyManager.resetSpecificAPI(projectName);
export const listAPIStatus = (): APIKeyStatus[] => PersistentAPIKeyManager.listAPIStatus(GEMINI_API_KEYS);
export const getAPIStats = () => PersistentAPIKeyManager.getStats(GEMINI_API_KEYS);

// ====================================================================================
// COLA DE SOLICITUDES GLOBAL Y LIMITADOR DE VELOCIDAD
// ====================================================================================
const requestQueue: { task: () => Promise<any>; resolve: (value: any) => void; reject: (reason?: any) => void; }[] = [];
let isProcessingQueue = false;
const MIN_REQUEST_INTERVAL = 1200; // ~50 RPM para estar seguros

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

// ====================================================================================
// LÓGICA DE ROTACIÓN DE API Y EJECUCIÓN
// ====================================================================================
const makeApiRequestWithRotation = async <T>(
    requestFn: (client: GoogleGenAI) => Promise<T>,
    availableKeys: any[]
): Promise<T> => {
    if (availableKeys.length === 0) {
        const stats = PersistentAPIKeyManager.getStats(GEMINI_API_KEYS);
        let userMessage = "Todas las claves de API están agotadas o bloqueadas temporalmente.";

        if (stats.dailyLimit + stats.permanentlyBlocked >= stats.total) {
            userMessage = "Todas las claves de API han alcanzado su límite diario. El servicio se reanudará automáticamente. Si crees que es un error, puedes resetear el estado de las claves en el panel de depuración.";
        }

        logger.log('ERROR', 'geminiService', userMessage);
        
        throw new Error(userMessage);
    }
    
    const keyData = availableKeys[0];
    const remainingKeys = availableKeys.slice(1);
    
    if (!keyData.api_key) {
        logger.log('ERROR', 'geminiService', `Clave de API indefinida para ${keyData.projectName}. Saltando.`);
        return makeApiRequestWithRotation(requestFn, remainingKeys);
    }
    const tempAi = new GoogleGenAI({ apiKey: keyData.api_key });

    try {
        const result = await requestFn(tempAi);
        PersistentAPIKeyManager.markAsSuccessful(keyData.id, keyData);
        return result;
    } catch (error: any) {
        const originalErrorMessage = error instanceof Error ? error.message : String(error);
        
        if (originalErrorMessage.toLowerCase().includes('quota') || originalErrorMessage.includes('429') || originalErrorMessage.includes('resource_exhausted') || originalErrorMessage.toLowerCase().includes('limit')) {
            logger.log('WARNING', 'geminiService', `Clave de API ${keyData.projectName} agotada. Rotando a la siguiente...`);
            PersistentAPIKeyManager.markAsExhausted(keyData.id, keyData, originalErrorMessage);
            return makeApiRequestWithRotation(requestFn, remainingKeys);
        }
        
        logger.log('ERROR', 'geminiService', `Error no relacionado con cuota en la clave ${keyData.projectName}`, error);
        throw error;
    }
};

const scheduleApiRequest = <T>(requestFn: (client: GoogleGenAI) => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        requestQueue.push({ 
            task: () => makeApiRequestWithRotation(requestFn, PersistentAPIKeyManager.getAvailableAPIs(GEMINI_API_KEYS)),
            resolve, 
            reject 
        });
        processQueue();
    });
};

// ====================================================================================
// AGENT SWARM ARCHITECTURE - SIN CAMBIOS, USA LA COLA
// ====================================================================================

const agent_generateLogline = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un guionista experto. Dada una idea, escribe una logline concisa y atractiva (1-2 frases). Responde solo con el texto de la logline.";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } }));
};
// ... (resto de agentes sin cambios)
const agent_identifyThemes = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un analista literario. Dada una idea, extrae 3-5 temas o palabras clave principales. Responde con una lista separada por comas (ej: 'sacrificio, tecnología, naturaleza').";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } }));
};

const agent_suggestAudience = (idea: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un estratega de marketing. Dada una idea, define el público objetivo ideal en una frase corta. (ej: 'Jóvenes adultos interesados en la ciencia ficción distópica').";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Idea: "${idea}"`, config: { systemInstruction } }));
};

const synthesizer_concept = (idea: string, logline: string, themes: string, audience: string): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un Agente Sintetizador de Conceptos. Tu trabajo es tomar la idea original y los elementos generados por otros agentes y combinarlos en un objeto JSON coherente y mejorado. Si los elementos no son coherentes, ajústalos. La respuesta DEBE ser un único objeto JSON válido con las claves 'idea', 'targetAudience', 'keyElements' y 'logline'. La respuesta debe estar en español.";
    const prompt = `Idea Original: "${idea}"\nLogline Propuesta: "${logline}"\nTemas Propuestos: "${themes}"\nPúblico Propuesto: "${audience}"\n\nSintetiza y refina estos elementos en un objeto JSON final.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json' } }));
};


const agent_suggestOutputFormats = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(outputFormats).flat().map(o => o.name);
    const systemInstruction = `Eres un productor de medios. Basado en el concepto, sugiere los 3 formatos de salida más efectivos de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const agent_suggestNarrativeStyles = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(narrativeStyles).flat().map(o => o.name);
    const systemInstruction = `Eres un guionista. Basado en el concepto, sugiere los 3 estilos narrativos más adecuados de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const agent_suggestVisualStyles = (concept: InitialConcept): Promise<GenerateContentResponse> => {
    const options = Object.values(visualStyles).flat().map(o => o.name);
    const systemInstruction = `Eres un director de arte. Basado en el concepto, sugiere los 3 estilos visuales más impactantes de esta lista: ${JSON.stringify(options)}. Responde con un array JSON de strings.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(concept), config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const synthesizer_style = (concept: InitialConcept, formatSuggestions: any, narrativeSuggestions: any, visualSuggestions: any): Promise<GenerateContentResponse> => {
    const systemInstruction = `Eres un 'Sintetizador Creativo'. Tu tarea es asegurar la coherencia. Analiza las sugerencias de estilo, formato y visuales en relación con el concepto. Si son incoherentes (ej. 'Cartoon' visual con 'Hiperrealista' narrativo), elige la combinación más lógica. Luego, escribe una 'styleNotesSuggestion' de 1-2 frases que resuma la dirección creativa. Tu respuesta DEBE ser un objeto JSON válido con las claves 'outputFormat', 'narrativeStyle', 'visualStyle', y 'styleNotesSuggestion'. La respuesta debe estar en español.`;
    const prompt = `Concepto: ${JSON.stringify(concept)}\nSugerencias de Formato: ${JSON.stringify(formatSuggestions)}\nSugerencias Narrativas: ${JSON.stringify(narrativeSuggestions)}\nSugerencias Visuales: ${JSON.stringify(visualSuggestions)}\n\nSintetiza, asegura la coherencia y genera la nota de estilo.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const agent_generateMotivation = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un escritor de personajes. Genera la motivación del personaje (desire, fear, need) basándote en su información. Responde con un objeto JSON con esas tres claves.";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const agent_generateFlawAndArc = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un escritor de personajes. Genera un defecto crítico ('flaw') y un arco de transformación ('arc') para el personaje. Responde con un objeto JSON con esas dos claves.";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const agent_generateVisuals = (context: any, character: Partial<CharacterDefinition>): Promise<GenerateContentResponse> => {
    const systemInstruction = "Eres un diseñador de personajes. Escribe una 'description' visual detallada y 3-5 'visual_prompt_enhancers' (palabras clave para IA) para este personaje. Responde con un objeto JSON con esas dos claves.";
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nPersonaje: ${JSON.stringify(character)}`, config: { systemInstruction, responseMimeType: 'application/json' } }));
};

const synthesizer_character = (context: any, character: Partial<CharacterDefinition>, motivation: any, flawArc: any, visuals: any): Promise<GenerateContentResponse> => {
    const systemInstruction = `Eres un 'Sintetizador de Personajes'. Tu tarea es combinar todos los elementos generados en un perfil de personaje coherente. Asegúrate de que la motivación, el defecto, el arco y la descripción visual se alineen. Refina la descripción general para que refleje todos los aspectos. Tu respuesta DEBE ser un objeto JSON válido con las claves 'description', 'motivation', 'flaw', 'arc', y 'visual_prompt_enhancers'. La respuesta debe estar en español.`;
    const prompt = `Contexto: ${JSON.stringify(context)}\nPersonaje Base: ${JSON.stringify(character)}\nMotivación: ${JSON.stringify(motivation)}\nDefecto y Arco: ${JSON.stringify(flawArc)}\nVisuales: ${JSON.stringify(visuals)}\n\nSintetiza en un perfil de personaje final y coherente.`;
    return scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: 'application/json' } }));
};

export const orchestrateConceptGeneration = async (idea: string, existingConcept: InitialConcept | null): Promise<InitialConcept> => {
    const finalIdea = existingConcept?.idea || idea;
    const [loglineRes, themesRes, audienceRes] = await Promise.all([
        agent_generateLogline(finalIdea),
        agent_identifyThemes(finalIdea),
        agent_suggestAudience(finalIdea)
    ]);

    const synthResponse = await synthesizer_concept(finalIdea, loglineRes.text, themesRes.text, audienceRes.text);
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
    ]);
    
    const synthResponse = await synthesizer_style(concept, parseJsonMarkdown(formatsRes.text), parseJsonMarkdown(narrativeRes.text), parseJsonMarkdown(visualRes.text));
    const parsedJson = parseJsonMarkdown(synthResponse.text);
    return AIStyleSuggestionSchema.parse(parsedJson);
};


export const orchestrateCharacterGeneration = async (context: { concept: InitialConcept, style: StyleAndFormat }, character: Partial<CharacterDefinition>): Promise<Partial<CharacterDefinition>> => {
    const [motivationRes, flawArcRes, visualsRes] = await Promise.all([
        agent_generateMotivation(context, character),
        agent_generateFlawAndArc(context, character),
        agent_generateVisuals(context, character)
    ]);

    const synthResponse = await synthesizer_character(context, character, parseJsonMarkdown(motivationRes.text), parseJsonMarkdown(flawArcRes.text), parseJsonMarkdown(visualsRes.text));
    const parsedJson = parseJsonMarkdown(synthResponse.text);
    return AICharacterDetailsSchema.parse(parsedJson);
};

// ====================================================================================
// PHOTO EDITOR & STORY BUILDER SERVICES (CON FALLBACK)
// ====================================================================================
interface GenerateImagesResponse { generatedImages: Array<{ image: { imageBytes: string; }; }>; }

export async function generateImageWithFallback(prompt: string): Promise<Blob> {
    logger.log('INFO', 'geminiService', `Intentando generar imagen (API): "${prompt.substring(0, 50)}..."`);
    try {
        const result = await scheduleApiRequest(client =>
            client.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: { numberOfImages: 1, aspectRatio: '1:1' }
            })
        ) as GenerateImagesResponse;
        const base64Data = result.generatedImages[0].image.imageBytes;
        return await (await fetch(`data:image/jpeg;base64,${base64Data}`)).blob();
    } catch (apiError: any) {
        logger.log('WARNING', 'geminiService', 'La generación con API falló, intentando fallback de Gemini Web.', apiError.message);
        
        if (geminiWebService.isInitialized()) {
            try {
                logger.log('INFO', 'geminiService', `Intentando generar imagen (Web Fallback): "${prompt.substring(0, 50)}..."`);
                return await geminiWebService.generateImage(prompt);
            } catch (webError: any) {
                logger.log('ERROR', 'geminiService', 'El fallback de Gemini Web también falló.', webError.message);
                throw new Error(`Ambos métodos de generación fallaron. API: ${apiError.message}. Web: ${webError.message}`);
            }
        } else {
            logger.log('ERROR', 'geminiService', 'El fallback no está disponible, se requiere conexión con la extensión.');
            throw new Error(`La API está sobrecargada y el modo de generación ilimitado (fallback) no está conectado. ${apiError.message}`);
        }
    }
}


export async function editImageWithMask(
    baseImage: File,
    maskImage: File,
    prompt: string,
    referenceImage?: File | null
): Promise<Blob> {
    const baseImagePart = await fileToGenerativePart(baseImage);
    const maskImagePart = await fileToGenerativePart(maskImage, "image/png");

    const contents: any[] = [ { text: prompt }, baseImagePart, maskImagePart ];
    if (referenceImage) {
        contents.push(await fileToGenerativePart(referenceImage));
    }

    const result: GenerateContentResponse = await scheduleApiRequest(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: contents },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
        })
    );
    
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
    const result: GenerateContentResponse = await scheduleApiRequest(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Mejora este prompt: "${prompt}"`,
            config: { systemInstruction }
        })
    );
    return result.text.trim();
}

export async function generatePhotoshootImages(
    subjectImage: File,
    scenePrompt: string,
    numImages: number,
    sceneImage?: File | null
): Promise<Blob[]> {
    logger.log('INFO', 'geminiService', `Generating ${numImages} photoshoot images...`);
    // Esta función ahora se beneficia del fallback automático.
    const imagePromises = Array(numImages).fill(0).map(() => generateImageWithFallback(scenePrompt));
    return Promise.all(imagePromises);
}

// ... (resto de funciones que no generan imágenes no necesitan cambios drásticos)
export async function getAIRecommendations(image: File, presets: any[], context: string): Promise<AIRecommendation[]> {
    const systemInstruction = "Eres un experto editor de fotos IA. Analiza la imagen y recomienda los 5 mejores ajustes preestablecidos de la lista proporcionada que mejorarían la foto, basándote en el contexto del usuario. Para cada recomendación, proporciona el nombre exacto del preestablecido, una razón concisa y una puntuación de confianza. También puedes sugerir un ajuste de balance de color si es necesario. Tu respuesta DEBE ser un objeto JSON válido.";
    const imagePart = await fileToGenerativePart(image);
    const prompt = `Contexto: "${context || 'Mejora general'}". Preestablecidos: ${JSON.stringify(presets.map(p => p.name))}. Analiza y recomienda. La respuesta DEBE estar en español.`;

    const result: GenerateContentResponse = await scheduleApiRequest(client =>
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{text: prompt}, imagePart] },
            config: { systemInstruction, responseMimeType: 'application/json' }
        })
    );
    return parseJsonMarkdown(result.text);
}

export async function getAIFilterRecommendations(image: File, presets: any[], context: string): Promise<{ presetName: string, reason: string }[]> {
    const systemInstruction = "Eres un director creativo IA. Analiza la imagen y recomienda los 5 mejores filtros de la lista proporcionada que encajarían estilísticamente, basándote en el contexto del usuario. Para cada recomendación, proporciona el nombre exacto del filtro y una razón concisa. Tu respuesta DEBE ser un objeto JSON válido.";
    const imagePart = await fileToGenerativePart(image);
    const prompt = `Contexto: "${context || 'Aplicar un filtro creativo'}". Filtros: ${JSON.stringify(presets.map(p => p.name))}. Analiza y recomienda. La respuesta DEBE estar en español.`;

    const result: GenerateContentResponse = await scheduleApiRequest(client =>
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{text: prompt}, imagePart] },
            config: { systemInstruction, responseMimeType: 'application/json' }
        })
    );
    return parseJsonMarkdown(result.text);
}


interface GenerateVideosResponse { generatedVideos?: Array<{ video?: { uri?: string; }; }>; }

const agent_analyzeOverallConcept = async (userInput: any): Promise<{ assessment: string; score: number }> => {
    const systemInstruction = `Eres un agente "Asesor de Concepto de Historia". Tu tarea es proporcionar una evaluación de alto nivel y una puntuación de coherencia (0-10) para el concepto de historia del usuario, basándote en todas las entradas proporcionadas. Tu respuesta DEBE ser un único objeto JSON válido con las claves "assessment" y "score". La respuesta debe estar en español.`;
    const result = await scheduleApiRequest(client =>
        client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } })
    );
    return parseJsonMarkdown(result.text);
};
const agent_analyzeConsistency = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un agente "Verificador de Consistencia". Analiza las entradas del usuario en busca de contradicciones entre estilo, personajes y trama. Identifica posibles agujeros en la trama. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return CoherenceCheckItemsSchema.parse(parseJsonMarkdown(result.text));
};

const agent_analyzePacingAndStructure = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un agente de "Ritmo y Estructura". Analiza si la estructura de 3 actos tiene un buen ritmo y es adecuada para el formato de salida elegido. Identifica debilidades en el flujo narrativo. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return CoherenceCheckItemsSchema.parse(parseJsonMarkdown(result.text));
};

const agent_analyzeCharacterArcs = async (userInput: any): Promise<CoherenceCheckItem[]> => {
    const systemInstruction = `Eres un "Analista de Arcos de Personajes". Analiza si las motivaciones, defectos y arcos de los personajes son convincentes y coherentes con el tema de la historia. Responde con un array de objetos "CoherenceCheckItem" en formato JSON. Si no encuentras problemas, devuelve un array vacío []. La respuesta debe estar en español. Ejemplo de formato: [{"id": "string", "element": "string", "concern": "string", "suggestion": "string", "severity": "low|medium|high"}]`;
    const result = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } }));
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
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(userInput), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return StoryMasterplanSchema.parse(parseJsonMarkdown(result.text));
};

export const critiqueStoryMasterplan = async (plan: StoryMasterplan): Promise<Critique> => {
    const systemInstruction = `Eres un editor de historias profesional y un experto en marketing viral. Tu análisis debe ser agudo y enfocado en maximizar el potencial de la historia. Proporciona tu feedback en un objeto JSON válido en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return parseJsonMarkdown(result.text);
};

export const applyCritiqueToMasterplan = async (plan: StoryMasterplan): Promise<StoryMasterplan> => {
    const systemInstruction = `Eres un "script doctor" IA. Tu tarea es reescribir y mejorar un plan de historia existente basándote en la crítica proporcionada. Integra las sugerencias de forma creativa. La salida debe ser un único objeto JSON válido con la estructura del "Story Masterplan" mejorado y en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return parseJsonMarkdown(result.text);
};

export const generateProductionBible = async (plan: StoryMasterplan): Promise<Documentation> => {
    const systemInstruction = `Eres un asistente de producción IA. Basándote en el "Story Masterplan", genera una "Biblia de Producción" que incluya: "Guía del Director", "Guía de Producción para IA", y "Guía de Estilo Visual". La salida debe ser un único objeto JSON válido en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return parseJsonMarkdown(result.text);
};

export const generateHookMatrix = async (plan: StoryMasterplan): Promise<HookMatrix> => {
    const systemInstruction = `Eres un Agente Adaptador de Ganchos "Scroll-Stopper". Analiza el "Story Masterplan" y genera una "Matriz de Ganchos" en formato JSON. Para CADA una de las 5 categorías (patternInterrupts, psychologicalTriggers, curiosityGaps, powerPhrases, provenStructures), DEBES generar exactamente 10 plantillas de ganchos únicas y creativas. Cada plantilla debe incluir una 'rationale'. La respuesta DEBE estar en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(plan), config: { systemInstruction, responseMimeType: 'application/json' } }));
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
    logger.log('WARNING', 'geminiService', 'generateVideoAssets no está completamente adaptado al nuevo sistema de cola y rotación aún.');
    onProgress({ stage: 'videos', status: 'in_progress', message: 'Iniciando pipeline de generación de video...' });
    const allScenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);
    if (!allScenes || allScenes.length === 0) throw new Error("No se encontraron escenas en el plan de historia para generar videos.");
    const finalAssets: FinalAssets = { videoAssets: [] };
    
    const tempAi = new GoogleGenAI({ apiKey: GEMINI_API_KEYS[0].api_key });

    for (const scene of allScenes) {
        const sceneId = `scene_${scene.scene_number}`;
        const progressMessage = `Generando video ${finalAssets.videoAssets.length + 1}/${allScenes.length}: Escena ${scene.scene_number}`;
        onProgress({ stage: 'videos', status: 'in_progress', message: progressMessage, sceneId });

        const prompt = scene.visual_elements_prompt || `Un clip de video de: ${scene.summary}`;
        let operation: Operation<GenerateVideosResponse> = await tempAi.models.generateVideos({ model: 'veo-2.0-generate-001', prompt: prompt, config: { numberOfVideos: 1 } });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await tempAi.operations.getVideosOperation({operation: operation});
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink || !process.env.API_KEY) throw new Error(`No se pudo obtener el enlace de descarga para la Escena ${scene.scene_number}.`);

        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
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
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: JSON.stringify(characters), config: { systemInstruction, responseMimeType: 'application/json' } }));
    return parseJsonMarkdown(result.text) as CharacterDefinition[];
};

export const generateOrImproveStoryStructure = async (context: any, existingStructure: StoryStructure): Promise<StoryStructure> => {
    const systemInstruction = `Eres un guionista profesional de IA. Genera o mejora el resumen de la estructura de tres actos. Si los resúmenes están vacíos, créalos. Si tienen contenido, mejóralos. El tono debe ser creativo. Tu respuesta DEBE ser un objeto JSON válido con 'act1_summary', 'act2_summary' y 'act3_summary' en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Contexto: ${JSON.stringify(context)}\nEstructura Existente: ${JSON.stringify(existingStructure)}`, config: { systemInstruction, responseMimeType: 'application/json' } }));
    return AIStoryStructureSchema.parse(parseJsonMarkdown(result.text)) as StoryStructure;
};

export const applyCoherenceFixes = async (storyData: any, selectedSuggestions: CoherenceCheckItem[]): Promise<Partial<ExportedProject>> => {
    const systemInstruction = `Eres un "Agente Refinador y Expansor" de IA. Reescribe y mejora los datos de una historia basándote en una lista de sugerencias. Enriquece los resúmenes de los actos para que sean más detallados y cinematográficos. Devuelve la estructura de datos COMPLETA y actualizada en un único objeto JSON en español.`;
    const result: GenerateContentResponse = await scheduleApiRequest(client => client.models.generateContent({ model: 'gemini-2.5-flash', contents: `DATOS ORIGINALES:${JSON.stringify(storyData)}\nSUGERENCIAS:${JSON.stringify(selectedSuggestions)}`, config: { systemInstruction, responseMimeType: 'application/json' } }));
    const RefinedDataSchema = z.object({ initialConcept: z.any().optional(), styleAndFormat: z.any().optional(), characters: z.array(z.any()).optional(), storyStructure: z.any().optional() }).partial();
    return RefinedDataSchema.parse(parseJsonMarkdown(result.text));
}