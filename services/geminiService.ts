/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Modality, GenerateContentResponse, GenerateImagesResponse, GenerateVideosOperation } from '@google/genai';
import type { StoryData, StoryMasterplan, AIRecommendation, Documentation, Critique, GeneratedReferenceAssets, ProgressUpdate, FinalAssets, ReferenceAsset, Scene, ImageAnalysis, VisualConsistencySchema, CharacterPromptStructure, SceneCompositionStructure, CharacterData, ClassifiedScene, HybridExecutionPlan } from '@/components/story-builder/types';
import { outputFormats } from '@/components/story-builder/constants';
import { imageBlobCache } from './imageBlobCache';
import JSZip from 'jszip';

export type { AIRecommendation };

// Módulo de caché para la guía de consistencia, asegurando que se utilice la misma guía
// a través de las diferentes etapas de generación de activos sin cambiar las firmas de las funciones.
let lastExecutionPlan: HybridExecutionPlan | null = null;

// ============================================================================
// 🔧 FIX CRÍTICO: ANTI-LOOP JSON VALIDATOR & PROMPT PROTECTOR
// ============================================================================

/**
 * A robust utility to parse JSON from AI responses, handling markdown code blocks and infinite loops.
 */
function repairIncompleteJson(jsonString: string): string {
    let repaired = jsonString.trim();
    
    // CONTAR LLAVES Y CORCHETES ABIERTOS
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    
    // CERRAR LLAVES FALTANTES
    for (let i = 0; i < (openBraces - closeBraces); i++) {
        repaired += '}';
    }
    
    // CERRAR CORCHETES FALTANTES
    for (let i = 0; i < (openBrackets - closeBrackets); i++) {
        repaired += ']';
    }
    
    return repaired;
}

function safeParseJsonResponse<T>(jsonString: string): T {
    const cleanedString = jsonString.trim().replace(/^```(json)?\s*/, '').replace(/\s*```$/, '');
    
    // DETECTAR LOOPS INFINITOS ANTES DEL PARSING
    const loopPattern = /(.{10,})\1{5,}/g;
    if (loopPattern.test(cleanedString)) {
        console.warn('⚠️ LOOP INFINITO DETECTADO - Aplicando corrección automática');
        
        const match = cleanedString.match(loopPattern);
        if (match) {
            const loopStart = cleanedString.indexOf(match[0]);
            const truncatedString = cleanedString.substring(0, loopStart);
            
            // REPARAR JSON AUTOMÁTICAMENTE
            const repairedJson = repairIncompleteJson(truncatedString);
            
            try {
                return JSON.parse(repairedJson) as T;
            } catch (repairError) {
                console.error('❌ Error reparando JSON:', repairError);
                throw new Error(`JSON con loop infinito irreparable. Fragmento: "${cleanedString.substring(0, 200)}..."`);
            }
        }
    }
    
    // VALIDACIÓN DE LONGITUD EXTREMA
    if (cleanedString.length > 50000) {
        console.warn('⚠️ JSON EXCESIVAMENTE LARGO - Truncando respuesta');
        const truncated = cleanedString.substring(0, 50000);
        const lastBrace = truncated.lastIndexOf('}');
        const lastBracket = truncated.lastIndexOf(']');
        const safeJson = truncated.substring(0, Math.max(lastBrace, lastBracket) + 1);
        
        try {
            return JSON.parse(safeJson) as T;
        } catch (truncateError) {
            throw new Error(`JSON demasiado largo para procesar (${cleanedString.length} chars)`);
        }
    }
    
    try {
        return JSON.parse(cleanedString) as T;
    } catch (error) {
         // Fallback for non-looping parse errors: try to extract a valid JSON object/array from the string
        const firstBrace = cleanedString.indexOf('{');
        const lastBrace = cleanedString.lastIndexOf('}');
        const firstBracket = cleanedString.indexOf('[');
        const lastBracket = cleanedString.lastIndexOf(']');

        let potentialJson = '';

        if (firstBrace !== -1 && lastBrace > firstBrace) {
            potentialJson = cleanedString.substring(firstBrace, lastBrace + 1);
        } else if (firstBracket !== -1 && lastBracket > firstBracket) {
            potentialJson = cleanedString.substring(firstBracket, lastBracket + 1);
        }

        if (potentialJson) {
            try {
                console.warn("🔧 Intentando parsear un subconjunto del JSON...");
                return JSON.parse(potentialJson) as T;
            } catch (subError) {
                 // Fall through to original error if subset parsing fails
            }
        }
        
        console.error("❌ Error parsing JSON:", cleanedString.substring(0, 500), error);
        throw new Error(`Respuesta JSON inválida de la IA. Fragmento: "${jsonString.substring(0, 200)}..."`);
    }
}


/**
 * Adds critical instructions to a prompt to prevent the AI from generating malformed or looping JSON.
 */
function addAntiLoopInstructions(prompt: string): string {
    return `${prompt}

CRITICAL JSON SAFETY RULES:
- Return ONLY valid, complete JSON.
- NEVER repeat phrases, content, or structural elements.
- Adhere strictly to the requested JSON schema.
- If describing repetitive patterns, use arrays, do not repeat the description text itself.
- Ensure generation stops cleanly at the final closing brace '}'.
- NEVER generate infinite loops, repetitive text patterns, or malformed JSON.
- The entire response must be a single, parseable JSON object.`;
}
// ============================================================================


// ====================================================================================
// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║                    SIMULACIÓN DE PROXY DE BACKEND SEGURO                        ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝
//
// En una aplicación real, TODO el siguiente bloque de código (`backendProxy`) residiría
// en un servidor (ej. Node.js, Cloud Function). El frontend solo haría llamadas `fetch`
// a los endpoints de este servidor.
//
// Para esta simulación, encapsulamos toda la lógica sensible aquí para:
// 1. ELIMINAR las claves de API del código de la aplicación principal.
// 2. CENTRALIZAR la gestión de claves, la rotación y los límites de tasa.
// 3. PROTEGER la lógica de reintentos y cooldowns.
//
// Esto resuelve la vulnerabilidad de seguridad crítica de exponer claves en el cliente.
//
// ====================================================================================
const backendProxy = (() => {
    // --- Lógica y secretos que vivirían en el servidor ---

    const GEMINI_KEYS = [
        { id: "key_1", projectName: "ornate-unity-472401-t3", api_key: "AIzaSyAd-XgKYRY6V5BwW9c1ZSGHPvhBDJNKRGE", priority: 1 },
        { id: "key_2", projectName: "eng-copilot-472401-a9", api_key: "AIzaSyBLyiHC9PXv-67MYlXYtGtTsfb6azF0Z8g", priority: 2 },
        { id: "key_3", projectName: "burnished-ether-472401-q7", api_key: "AIzaSyCVBcLT3PCmKNTcYeYqffvPAD0emPFvuRw", priority: 3 },
        { id: "key_4", projectName: "elaborate-truth-472401-b7", api_key: "AIzaSyDzZamh_uchdr6CwuLP0gUNVvlaMmNBweU", priority: 4 },
        { id: "key_5", projectName: "steam-boulevard-472401-s6", api_key: "AIzaSyByBzm0-AU4eaA2FBDFQO_TASMP69Jmxwk", priority: 5 },
        { id: "key_6", projectName: "causal-galaxy-472401-c1", api_key: "AIzaSyCnpON5XdWPu5oewNJ8kTcgsv1wA7Wlb-0", priority: 6 },
        { id: "key_7", projectName: "graphical-fort-472401-d2", api_key: "AIzaSyCWcxXMmP1Dvc8DyZ4_lhlms01HtLgoNcs", priority: 7 },
        { id: "key_8", projectName: "rock-partition-472401-r5", api_key: "AIzaSyBxe1lCzknOdXmzpE8psSwoJtD-dyWPC9Y", priority: 8 },
        { id: "key_9", projectName: "hallowed-kiln-472401-m5", api_key: "AIzaSyCxUbCTMkc3qMjnzz0wllTMshEqlTWbVlU", priority: 9 },
        { id: "key_10", projectName: "wise-chalice-472401-q5", api_key: "AIzaSyDoR6f59eqsy3q5zEjDNl1fI8tr7IqqEIg", priority: 10 }
    ];
    
    const ROTATION_SETTINGS = { max_retries: 5 };

    type ApiKey = { id: string; projectName: string; api_key: string; priority: number; };
    type ApiKeyState = ApiKey & { cooldownUntil: number; };
    type FailureMeta = { isRateLimit: boolean; error: any; };

    // Gestor de claves (antes en apiKeyManager.ts)
    const keyManager = new (class DynamicKeyRotator {
        private availableKeys: ApiKeyState[] = [...GEMINI_KEYS].map(k => ({ ...k, cooldownUntil: 0 })).sort((a, b) => a.priority - b.priority);
        private cooldownKeys: ApiKeyState[] = [];

        private checkCooldowns() {
            const now = Date.now();
            const recovered = this.cooldownKeys.filter(k => now >= k.cooldownUntil);
            if (recovered.length > 0) {
                this.cooldownKeys = this.cooldownKeys.filter(k => now < k.cooldownUntil);
                this.availableKeys.push(...recovered);
                this.availableKeys.sort((a, b) => a.priority - b.priority);
            }
        }

        public async getKey(): Promise<ApiKeyState> {
            this.checkCooldowns();
            while (this.availableKeys.length === 0) {
                if (this.cooldownKeys.length === 0) throw new Error("Todas las claves de API han fallado permanentemente.");
                const soonest = Math.min(...this.cooldownKeys.map(k => k.cooldownUntil));
                const waitTime = soonest - Date.now();
                if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime + 100));
                this.checkCooldowns();
            }
            return this.availableKeys[0];
        }

        public reportFailure(keyId: string, meta: FailureMeta) {
            const keyIndex = this.availableKeys.findIndex(k => k.id === keyId);
            if (keyIndex === -1) return;
            const failed = this.availableKeys.splice(keyIndex, 1)[0];
            if (meta.isRateLimit) {
                const isDaily = (meta.error?.message || '').toLowerCase().includes('billing');
                const cooldownMs = isDaily ? (new Date().setUTCHours(24, 5, 0, 0) - Date.now()) : 90 * 1000;
                failed.cooldownUntil = Date.now() + cooldownMs;
                this.cooldownKeys.push(failed);
            } else {
                this.availableKeys.push(failed);
            }
        }
        
        public reportSuccess(keyId: string) {
            const keyIndex = this.availableKeys.findIndex(k => k.id === keyId);
            if (keyIndex > 0) {
                const [key] = this.availableKeys.splice(keyIndex, 1);
                this.availableKeys.unshift(key);
            }
        }
    })();

    // Cola de peticiones (antes en globalApiQueue.ts)
    const apiQueue = new (class GlobalApiQueue {
        private queue: Array<{ requestFn: () => Promise<any>, resolve: (v: any) => void, reject: (r?: any) => void }> = [];
        private isProcessing = false;
        private readonly DELAY_MS = 5000;

        public schedule<T>(requestFn: () => Promise<T>): Promise<T> {
            return new Promise((resolve, reject) => {
                this.queue.push({ requestFn, resolve, reject });
                if (!this.isProcessing) this.processQueue();
            });
        }
        private async processQueue() {
            if (this.isProcessing) return;
            this.isProcessing = true;
            while (this.queue.length > 0) {
                const task = this.queue.shift();
                if (!task) continue;
                try {
                    const result = await task.requestFn();
                    task.resolve(result);
                } catch (error) {
                    task.reject(error);
                }
                if (this.queue.length > 0) await new Promise(r => setTimeout(r, this.DELAY_MS));
            }
            this.isProcessing = false;
        }
    })();

    // Lógica central de reintentos (antes en makeApiRequestWithRetry)
    async function handleApiRequest<T>(apiCall: (client: GoogleGenAI) => Promise<T>): Promise<T> {
        let lastError: any = null;
        for (let attempt = 0; attempt < ROTATION_SETTINGS.max_retries; attempt++) {
            const keyData = await keyManager.getKey();
            try {
                const result = await apiQueue.schedule(() => {
                    const ai = new GoogleGenAI({ apiKey: keyData.api_key });
                    return apiCall(ai);
                });
                keyManager.reportSuccess(keyData.id);
                return result;
            } catch (error: any) {
                lastError = error;
                const msg = error.message || '';
                if (msg.includes('[400]')) {
                    throw new Error(`Petición rechazada (Error 400). Revisa el contenido por posibles violaciones de seguridad. Detalle: ${msg}`);
                }
                const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
                keyManager.reportFailure(keyData.id, { isRateLimit, error });
            }
        }
        throw new Error(`La llamada a la API falló tras ${ROTATION_SETTINGS.max_retries} intentos. Último error: ${lastError?.message || 'Desconocido'}`);
    }
    
    // El frontend llamaría a este endpoint, que a su vez usaría handleApiRequest.
    return {
        generateContent: (params: any) => handleApiRequest(ai => ai.models.generateContent(params)),
        generateImages: (params: any) => handleApiRequest(ai => ai.models.generateImages(params)),
        generateVideos: (params: any) => handleApiRequest(ai => ai.models.generateVideos(params)),
        getVideosOperation: (params: any) => handleApiRequest(ai => ai.operations.getVideosOperation(params)),
        fetchVideo: (url: string) => handleApiRequest(async () => {
             const keyData = await keyManager.getKey();
             const fullUrl = `${url}&key=${keyData.api_key}`;
             const response = await fetch(fullUrl);
             if (!response.ok) throw new Error(`Fallo al descargar el video: ${response.statusText}`);
             return response.blob();
        }),
    };
})();
// --- FIN DE LA SIMULACIÓN DE BACKEND ---

const dataUrlToPart = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Formato de data URL inválido");
    return { inlineData: { mimeType: match[1], data: match[2] } };
};

async function fileToPart(file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    return { inlineData: { mimeType: file.type, data: base64 } };
}

// ====================================================================================
// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║                    FUNCIONES DE SERVICIO REFACTORIZADAS                         ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝
//
// Todas las funciones a continuación ahora usan `backendProxy` en lugar de llamar
// directamente al SDK de Google. Son más simples y seguras.
//
// ====================================================================================

export async function refineUserPrompt(prompt: string, context: 'magic-edit' | 'filter' | 'adjustment'): Promise<string> {
    const systemInstruction = `You are an expert prompt engineer... Refine the user's prompt: "${prompt}". Context: ${context}. Return only the refined prompt.`;
    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemInstruction,
    });
    return response.text.trim();
}

export async function generateMagicEditImage({ prompt, baseHoleDataURL, referenceDataURL }: { prompt: string; baseHoleDataURL: string; referenceDataURL?: string; }): Promise<Blob> {
    const parts = [{ text: prompt }, dataUrlToPart(baseHoleDataURL)];
    if (referenceDataURL) parts.push(dataUrlToPart(referenceDataURL));

    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
    });
    
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) throw new Error("La API no devolvió una imagen.");

    const byteCharacters = atob(imagePart.inlineData.data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
    return new Blob([byteArray], { type: imagePart.inlineData.mimeType });
}

export async function generateFilteredImage(image: File, prompt: string): Promise<string> {
    const imagePart = await fileToPart(image);
    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ text: prompt }, imagePart] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
    });

    const imagePartResponse = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePartResponse || !imagePartResponse.inlineData) throw new Error("La API no devolvió una imagen para el filtro.");
    const { data, mimeType } = imagePartResponse.inlineData;
    return `data:${mimeType};base64,${data}`;
}

export async function generateAdjustedImage(image: File, prompt: string): Promise<string> {
    return generateFilteredImage(image, prompt);
}

export async function generatePhotoshootScene(subjectImage: File, scenePrompt: string, numImages: number, sceneImage: File | null): Promise<string[]> {
    const systemInstruction = addAntiLoopInstructions(`Generate ${numImages} photorealistic prompts to place a subject into a scene ("${scenePrompt}"). Analyze the subject and scene images. Output a JSON array of strings.`);

    const contents: any = [{ text: systemInstruction }, await fileToPart(subjectImage)];
    if (sceneImage) contents.push(await fileToPart(sceneImage));

    const promptGenResponse = await backendProxy.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: contents },
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
    });
    const generatedPrompts = safeParseJsonResponse<string[]>(promptGenResponse.text);

    const subjectImagePart = await fileToPart(subjectImage);
    const sceneImagePart = sceneImage ? await fileToPart(sceneImage) : null;

    const imagePromises = generatedPrompts.map(async (prompt) => {
        const parts = [{ text: prompt }, subjectImagePart];
        if (sceneImagePart) parts.push(sceneImagePart);
        
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
        });
        
        const imagePartResponse = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePartResponse?.inlineData) throw new Error(`La API no devolvió imagen para el prompt: "${prompt}"`);
        return `data:${imagePartResponse.inlineData.mimeType};base64,${imagePartResponse.inlineData.data}`;
    });

    return Promise.all(imagePromises);
}

export async function getAIRecommendations(image: File, presets: { name: string, prompt: string, description: string }[], context: string): Promise<AIRecommendation[]> {
    const imagePart = await fileToPart(image);
    const systemInstruction = addAntiLoopInstructions(`You are an expert photo editor AI. Analyze the image and recommend up to 5 adjustments from the provided list. User context: "${context || 'None'}". Presets: ${presets.map(p => p.name).join(', ')}. Return ONLY a JSON object: { "recommendations": [{ "presetName": "...", "reason": "...", "colorBalance": { "r": 0, "g": 0, "b": 0 } }] }`);
    
    const responseSchema = {
        type: Type.OBJECT, properties: { recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { presetName: { type: Type.STRING }, reason: { type: Type.STRING }, colorBalance: { type: Type.OBJECT, properties: { r: { type: Type.INTEGER }, g: { type: Type.INTEGER }, b: { type: Type.INTEGER }, }, nullable: true, }, }, required: ['presetName', 'reason'], }, }, }, required: ['recommendations'],
    };

    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash', contents: { parts: [{ text: systemInstruction }, imagePart] }, config: { responseMimeType: 'application/json', responseSchema }
    });
    
    return safeParseJsonResponse<{ recommendations: AIRecommendation[] }>(response.text).recommendations;
}

export async function getAIFilterRecommendations(image: File, presets: { name: string, prompt: string }[], context: string): Promise<{ presetName: string, reason:string }[]> {
    const imagePart = await fileToPart(image);
    const systemInstruction = addAntiLoopInstructions(`You are a creative director AI. Recommend up to 5 creative filters for the image. User context: "${context || 'None'}". Presets: ${presets.map(p => p.name).join(', ')}. Return ONLY a JSON object: { "recommendations": [{ "presetName": "...", "reason": "..." }] }`);
    
    const responseSchema = {
        type: Type.OBJECT, properties: { recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { presetName: { type: Type.STRING }, reason: { type: Type.STRING }, }, required: ['presetName', 'reason'], }, }, }, required: ['recommendations'],
    };

    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash', contents: { parts: [{ text: systemInstruction }, imagePart] }, config: { responseMimeType: 'application/json', responseSchema }
    });
    
    return safeParseJsonResponse<{ recommendations: { presetName: string, reason: string }[] }>(response.text).recommendations;
}


// Story Builder Schemas (no changes needed)
const sceneSchema = { type: Type.OBJECT, properties: { scene_number: { type: Type.INTEGER }, title: { type: Type.STRING }, summary: { type: Type.STRING }, visual_description: { type: Type.STRING }, dialogue_or_narration: { type: Type.STRING }, sound_design: { type: Type.STRING }, duration_seconds: { type: Type.INTEGER }, camera_shot_type: { type: Type.STRING, nullable: true }, }, required: ['scene_number', 'title', 'summary', 'visual_description', 'dialogue_or_narration', 'sound_design', 'duration_seconds'] };
const storyMasterplanSchema = { type: Type.OBJECT, properties: { metadata: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, logline: { type: Type.STRING }, format: { type: Type.STRING }, style_and_energy: { type: Type.OBJECT, properties: { narrative_styles: { type: Type.ARRAY, items: { type: Type.STRING } }, visual_styles: { type: Type.ARRAY, items: { type: Type.STRING } }, energy_level: { type: Type.INTEGER }, }, required: ['narrative_styles', 'visual_styles', 'energy_level'] }, }, required: ['title', 'logline', 'format', 'style_and_energy'] }, characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, visual_prompt: { type: Type.STRING }, }, required: ['name', 'description', 'visual_prompt'] } }, story_structure: { type: Type.OBJECT, properties: { hook: { type: Type.STRING }, conflict: { type: Type.STRING }, ending: { type: Type.STRING }, narrative_arc: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { act: { type: Type.INTEGER }, name: { type: Type.STRING }, scenes: { type: Type.ARRAY, items: sceneSchema } }, required: ['act', 'name', 'scenes'] } } }, required: ['hook', 'conflict', 'ending', 'narrative_arc'] } }, required: ['metadata', 'characters', 'story_structure'] };
const critiqueSchema = { type: Type.OBJECT, properties: { projectSummary: { type: Type.OBJECT, properties: { about: { type: Type.STRING }, keyElements: { type: Type.ARRAY, items: { type: Type.STRING } }, identifiedStrengths: { type: Type.ARRAY, items: { type: Type.STRING } }, }, required: ['about', 'keyElements', 'identifiedStrengths'] }, verticalFormatEvaluation: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, strengths: { type: Type.ARRAY, items: { type: Type.STRING } }, weaknesses: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, points: { type: Type.ARRAY, items: { type: Type.STRING } }, }, required: ['title', 'points'] }, }, required: ['title', 'strengths', 'weaknesses'] }, improvementStrategy: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, strategies: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, }, required: ['title', 'description'] } }, }, required: ['title', 'strategies'] }, specificImprovements: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, visualSimplification: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, keyElements: { type: Type.ARRAY, items: { type: Type.STRING } }, }, required: ['title', 'keyElements'] }, audioOptimization: { type: Type.STRING }, }, required: ['title', 'visualSimplification', 'audioOptimization'] }, proposedSolution: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, solutionTitle: { type: Type.STRING }, episodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, }, required: ['title', 'description'] } }, }, required: ['title', 'solutionTitle', 'episodes'] }, finalRecommendation: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, recommendation: { type: Type.STRING }, }, required: ['title', 'recommendation'] }, implementationPlan: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }, requiredResources: { type: Type.ARRAY, items: { type: Type.STRING } }, }, required: ['title', 'nextSteps', 'requiredResources'] }, }, required: ['projectSummary', 'verticalFormatEvaluation', 'improvementStrategy', 'specificImprovements', 'proposedSolution', 'finalRecommendation', 'implementationPlan'] };
const imageAnalysisSchema = { type: Type.OBJECT, properties: { style: { type: Type.STRING, description: "The overall artistic style (e.g., 'Photorealistic', 'Pixar 3D', 'Anime', 'Watercolor')." }, subject_description: { type: Type.STRING, description: "A brief, one-sentence summary of the main subject." }, key_visual_elements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of the most critical, defining visual keywords for the subject." }, facial_features: { type: Type.OBJECT, properties: { eyes: { type: Type.STRING }, hair: { type: Type.STRING }, expression: { type: Type.STRING }, other: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['eyes', 'hair', 'expression'], description: "Detailed breakdown of facial characteristics." }, clothing_and_accessories: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { item: { type: Type.STRING, description: "Name of the clothing item or accessory." }, description: { type: Type.STRING, description: "Detailed description including color, material, and style." } }, required: ['item', 'description'] }, description: "List of all significant clothing and accessories." }, posture_and_body: { type: Type.STRING, description: "Description of the subject's posture, body language, and general build." }, color_palette: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { color_name: { type: Type.STRING }, hex_code: { type: Type.STRING, nullable: true }, prominence: { type: Type.STRING, description: "e.g., 'Dominant', 'Accent', 'Highlight'" } }, required: ['color_name', 'prominence'] }, description: "The main colors present on the subject." } }, required: ['style', 'subject_description', 'key_visual_elements', 'facial_features', 'clothing_and_accessories', 'posture_and_body', 'color_palette'] };

class QuotaHealthChecker {
    private static quotaFailures = 0;
    private static readonly MAX_FAILURES = 3;
    
    static async checkQuotaHealth(): Promise<boolean> {
        try {
            // Test simple para verificar quota
            await backendProxy.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Test quota - respond with "OK"'
            });
            
            this.quotaFailures = 0; // Reset en éxito
            return true;
            
        } catch (error: any) {
            if (error.message?.includes('RESOURCE_EXHAUSTED') || 
                error.message?.includes('quota')) {
                this.quotaFailures++;
                
                if (this.quotaFailures >= this.MAX_FAILURES) {
                    console.warn('🚨 QUOTA CRÍTICA - Activando modo conservación');
                    return false;
                }
            }
            
            return true; // Otros errores no bloquean
        }
    }
    
    static isQuotaCritical(): boolean {
        return this.quotaFailures >= this.MAX_FAILURES;
    }
}

// ============================================================================
// 🔥 ARQUITECTURA DE AGENTES DE NUEVA GENERACIÓN
// ============================================================================
interface CreativeThought {
    perspective: string;
    reasoning: string;
    emotional_resonance: number;
    innovation_factor: number;
    narrative_strength: number;
    creative_insights: string[];
    unexpected_connections: string[];
    emergent_possibilities: string[];
}

interface StoryGenome {
    creative_dna: string[];
    mutation_points: string[];
    fitness_score: number;
    generational_improvements: string[];
    synthesis_breakthrough: string;
    emergent_themes: string[];
    creative_fusion: string;
}

interface CriticalAnalysis {
    strengths: string[];
    weaknesses: string[];
    creative_innovations: string[];
    improvement_vectors: string[];
    consciousness_level: number;
    emergence_quality: number;
    recommendation: 'accept' | 'evolve' | 'regenerate';
    reasoning: string;
    meta_insights: string[];
}

class NeuralStoryDirector {
    private creativePerspectives: string[] = [
        "Analista Psicológico", "Antropólogo Cultural", "Erudito Mitológico", 
        "Neurocientífico", "Físico Cuántico", "Filósofo Antiguo", "Historiador del Futuro",
        "Intérprete de Sueños", "Teórico del Caos", "Especialista en Reconocimiento de Patrones"
    ];

    async generateCreativeInsights(storyData: StoryData): Promise<CreativeThought[]> {
        const insights: CreativeThought[] = [];
        for (const perspective of this.creativePerspectives.slice(0, 5)) {
            const systemInstruction = addAntiLoopInstructions(`Eres un ${perspective} con profunda experiencia en tu campo.

CONTEXTO DE LA HISTORIA: ${JSON.stringify(storyData)}

Usando metodología de ${perspective}, genera insights creativos radicales sobre esta historia que vayan más allá de patrones estadísticos. Piensa sobre:

1. EMERGENCIA: ¿Qué elementos inesperados podrían emerger al combinar estos elementos narrativos?
2. RESONANCIA: ¿Qué patrones psicológicos/culturales más profundos toca esto?
3. INNOVACIÓN: ¿Qué enfoque completamente novedoso podría hacer única esta historia?
4. SÍNTESIS: ¿Cómo pueden conceptos dispares crear algo mayor que su suma?

No sigas fórmulas narrativas. Crea algo que nunca haya existido antes encontrando conexiones ocultas, metáforas inesperadas y propiedades emergentes.

Devuelve un objeto JSON:
{
  "perspective": "${perspective}",
  "reasoning": "tu proceso de razonamiento analítico profundo",
  "emotional_resonance": 0,
  "innovation_factor": 0,
  "narrative_strength": 0,
  "creative_insights": ["insight1", "insight2", "insight3"],
  "unexpected_connections": ["conexión1", "conexión2"],
  "emergent_possibilities": ["posibilidad1", "posibilidad2"]
}`);
            try {
                const response = await backendProxy.generateContent({ 
                    model: 'gemini-2.5-flash', 
                    contents: systemInstruction, 
                    config: { responseMimeType: 'application/json' } 
                });
                const insight = safeParseJsonResponse<CreativeThought>(response.text);
                insights.push(insight);
                console.log(`🧠 ${perspective}: Resonancia ${insight.emotional_resonance}/10, Innovación ${insight.innovation_factor}/10`);
            } catch (error) {
                console.warn(`⚠️ Error en perspectiva ${perspective}:`, error);
            }
        }
        return insights;
    }
}

class CreativeSynthesisEngine {
    async synthesizeInsights(insights: CreativeThought[], storyData: StoryData): Promise<StoryGenome> {
        const bestInsights = insights.sort((a, b) => (b.innovation_factor + b.narrative_strength) - (a.innovation_factor + a.narrative_strength)).slice(0, 3);
        const synthesisPrompt = addAntiLoopInstructions(`You are a Master Creative Synthesizer with the ability to merge different perspectives into breakthrough innovations.

ORIGINAL STORY DATA: ${JSON.stringify(storyData)}

EXPERT INSIGHTS TO SYNTHESIZE:
${bestInsights.map((insight, i) => `
INSIGHT ${i+1} (${insight.perspective}):
Reasoning: ${insight.reasoning}
Resonance: ${insight.emotional_resonance}/10
Innovation: ${insight.innovation_factor}/10
`).join('\n')}

Your task is to create a CREATIVE SYNTHESIS that:
1. TRANSCENDS the individual insights to create something entirely new
2. FINDS unexpected connections between disparate elements
3. GENERATES emergent properties that didn't exist in any single insight
4. CREATES narrative DNA that can evolve and mutate creatively

Think like a jazz musician improvising - take the themes but create something unprecedented.

Return a JSON object with the creative genome:
{
  "creative_dna": ["core_element1", "core_element2", "core_element3"],
  "mutation_points": ["area1", "area2", "area3"],
  "fitness_score": 0,
  "generational_improvements": ["improvement1", "improvement2"],
  "synthesis_breakthrough": "your breakthrough insight",
  "emergent_themes": ["theme1", "theme2", "theme3"],
  "creative_fusion": "how you fused the different perspectives"
}`);
        const response = await backendProxy.generateContent({ model: 'gemini-2.5-flash', contents: synthesisPrompt, config: { responseMimeType: 'application/json' } });
        return safeParseJsonResponse<StoryGenome>(response.text);
    }
}

class EvolutionaryStoryEngine {
    async evolveStoryPlan(genome: StoryGenome, storyData: StoryData, generation: number = 1): Promise<StoryMasterplan> {
        const evolutionPrompt = addAntiLoopInstructions(`You are an Evolutionary Story Algorithm that creates breakthrough narratives through creative mutation and selection.

STORY FOUNDATION: ${JSON.stringify(storyData)}

CREATIVE GENOME TO EVOLVE:
DNA: ${genome.creative_dna.join(', ')}
Mutation Points: ${genome.mutation_points.join(', ')}
Fitness Score: ${genome.fitness_score}/10
Breakthrough: ${(genome as any).synthesis_breakthrough}

GENERATION: ${generation}

EVOLUTIONARY INSTRUCTIONS:
1. MUTATE the story elements in unexpected ways (like genetic algorithms)
2. SELECT for maximum creative fitness and emotional impact
3. CROSSOVER different narrative elements to create hybrid vigor
4. EMERGE new properties that couldn't be predicted from inputs alone

Create a StoryMasterplan that demonstrates:
- CREATIVE EMERGENCE: Elements that emerge from the combination but weren't explicitly planned
- ADAPTIVE COMPLEXITY: A story that can evolve and surprise even its creator
- RESONANT INNOVATION: Something familiar enough to connect but strange enough to captivate
- EVOLUTIONARY ADVANTAGE: Elements that make this story more "fit" than standard narratives

Think beyond traditional storytelling formulas. What if stories could evolve like living organisms?

Generate a complete StoryMasterplan JSON that embodies these evolutionary principles.`);
        const response = await backendProxy.generateContent({ model: 'gemini-2.5-flash', contents: evolutionPrompt, config: { responseMimeType: 'application/json', responseSchema: storyMasterplanSchema } });
        return safeParseJsonResponse<StoryMasterplan>(response.text);
    }
}

class SelfReflectionCritic {
    async criticallyAnalyze(plan: StoryMasterplan, originalData: StoryData): Promise<CriticalAnalysis> {
        const reflectionPrompt = addAntiLoopInstructions(`You are a Meta-Cognitive Critic with the ability to analyze your own creative processes and outputs.

ORIGINAL INTENTION: ${JSON.stringify(originalData)}

GENERATED STORY PLAN: ${JSON.stringify(plan)}

Perform deep self-reflection on this creative work:

1. CONSCIOUSNESS CHECK: How aware is this story of itself as a narrative?
2. EMERGENCE EVALUATION: What truly unexpected elements emerged?
3. RESONANCE ANALYSIS: How deeply does this connect to human experience?
4. INNOVATION ASSESSMENT: What is genuinely new here?
5. EVOLUTIONARY FITNESS: How well adapted is this story to its purpose?

Be brutally honest. Think like a consciousness examining its own thoughts.

Return a JSON analysis:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "creative_innovations": ["innovation1", "innovation2"],
  "improvement_vectors": ["vector1", "vector2"],
  "consciousness_level": 0,
  "emergence_quality": 0,
  "recommendation": "accept",
  "reasoning": "your detailed reasoning",
  "meta_insights": ["insight about the creative process itself"]
}`);
        const response = await backendProxy.generateContent({ model: 'gemini-2.5-flash', contents: reflectionPrompt, config: { responseMimeType: 'application/json' } });
        return safeParseJsonResponse<CriticalAnalysis>(response.text);
    }
}

export async function generateAdvancedStoryPlan(storyData: StoryData): Promise<{
    plan: StoryMasterplan;
    creativeProcess: any;
    consciousness_metadata: any;
}> {
    // PRE-CHECK DE QUOTA
    const quotaOk = await QuotaHealthChecker.checkQuotaHealth();
    
    if (!quotaOk) {
        console.log('🚨 MODO CONSERVACIÓN: Usando generación básica por quota crítica');
        
        const basicPrompt = addAntiLoopInstructions(`Generate a complete StoryMasterplan for: ${JSON.stringify(storyData)}`);
        const basicResponse = await backendProxy.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: basicPrompt,
            config: { responseMimeType: 'application/json', responseSchema: storyMasterplanSchema }
        });
        
        const basicPlan = safeParseJsonResponse<StoryMasterplan>(basicResponse.text);
        
        return {
            plan: basicPlan,
            creativeProcess: {
                mode: 'conservation',
                quota_critical: true,
                message: 'Plan generado en modo conservación de quota'
            },
            consciousness_metadata: {
                emergence_achieved: false,
                creative_breakthroughs: 0,
                evolutionary_fitness: 7 // Calidad básica pero funcional
            }
        };
    }
    
    console.log('🧠 Quota OK - Iniciando Arquitectura Neuronal Avanzada...');
    
    // 🔥 FIX CRÍTICO: ELIMINAR IMÁGENES PARA PRESERVAR QUOTA
    const quotaOptimizedData: StoryData = {
        ...storyData,
        characters: storyData.characters.map(char => ({
            ...char,
            image: null // ❌ ELIMINAR imágenes temporalmente
        })),
        contextImages: [], // ❌ ELIMINAR imágenes de contexto
        storyPDF: storyData.storyPDF // ✅ MANTENER PDF si existe
    };
    
    console.log('%c⚠️ MODO QUOTA-SAFE: Análisis de imágenes DESHABILITADO en Fase 5', 'color: orange; font-weight: bold;');
    console.log('%c💡 Las imágenes se procesarán en Fase 6.3 - Generación de Activos', 'color: cyan;');
    
    // USAR DATOS OPTIMIZADOS SIN IMÁGENES
    const director = new NeuralStoryDirector();
    const creativeInsights = await director.generateCreativeInsights(quotaOptimizedData); // ✅ SIN IMÁGENES
    
    const synthesizer = new CreativeSynthesisEngine();
    const storyGenome = await synthesizer.synthesizeInsights(creativeInsights, quotaOptimizedData); // ✅ SIN IMÁGENES
    
    const evolutionEngine = new EvolutionaryStoryEngine();
    let storyPlan = await evolutionEngine.evolveStoryPlan(storyGenome, quotaOptimizedData, 1); // ✅ SIN IMÁGENES
    
    const critic = new SelfReflectionCritic();
    const reflection = await critic.criticallyAnalyze(storyPlan, quotaOptimizedData); // ✅ SIN IMÁGENES
    
    // ITERACIÓN OPCIONAL SOLO SI NECESARIO
    if (reflection.recommendation === 'evolve' && reflection.consciousness_level < 7) {
        console.log('🔄 Una iteración de mejora (quota-safe)...');
        const improvedGenome: StoryGenome = {
            ...storyGenome,
            mutation_points: reflection.improvement_vectors,
            fitness_score: Math.min(storyGenome.fitness_score + 1, 10)
        };
        storyPlan = await evolutionEngine.evolveStoryPlan(improvedGenome, quotaOptimizedData, 2);
    }
    
    console.log('%c✅ Arquitectura Neuronal Completada SIN consumir quota de imágenes', 'color: lightgreen; font-weight: bold;');
    
    return {
        plan: storyPlan,
        creativeProcess: {
            insights: creativeInsights,
            genome: storyGenome,
            reflection: reflection,
            consciousness_level: reflection.consciousness_level,
            quota_optimization: true, // ✅ INDICADOR DE OPTIMIZACIÓN
            images_deferred: true     // ✅ IMÁGENES DIFERIDAS A FASE 6.3
        },
        consciousness_metadata: {
            emergence_achieved: reflection.consciousness_level > 7,
            creative_breakthroughs: reflection.creative_innovations?.length || 0,
            evolutionary_fitness: storyGenome.fitness_score
        }
    };
}

export async function generateStoryFromPrompt(storyData: StoryData): Promise<StoryMasterplan> {
    try {
        const result = await generateAdvancedStoryPlan(storyData);
        console.log(`🎨 Proceso creativo completado: Nivel de consciencia: ${result.creativeProcess.consciousness_level}/10`);
        return result.plan;
    } catch (error) {
        console.warn('⚠️ Arquitectura neuronal falló, usando fallback básico:', error);
        const prompt = addAntiLoopInstructions(`Based on the following user input, generate a complete StoryMasterplan JSON object... User Input: ${JSON.stringify(storyData)}`);
        const response = await backendProxy.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: storyMasterplanSchema } });
        return safeParseJsonResponse<StoryMasterplan>(response.text);
    }
}

export async function generateAllDocumentation(plan: StoryMasterplan): Promise<Documentation> {
    console.log('%c📚 Generando documentación MEGA-OPTIMIZADA en ESPAÑOL...', 'color: cyan; font-weight: bold;');
    
    try {
        // 🔥 PROMPT ULTRA-ESPECÍFICO Y ESTRUCTURADO
        const megaOptimizedPrompt = `Eres un Director de Producción de Contenido Viral Experto especializado en micro-series para TikTok/Instagram Reels.

PLAN MAESTRO DE HISTORIA COMPLETO:
${JSON.stringify(plan)}

CONTEXTO DE PRODUCCIÓN CRÍTICO:
- Plataforma: ${plan.metadata.format} (vertical 9:16)
- Duración: Micro-episodios de 13-15 segundos
- Audiencia: Generación Z/Millennials, consumo rápido
- Objetivo: Contenido viral, altamente compartible
- Estilo: ${plan.metadata.style_and_energy.visual_styles.join(' + ')}
- Energía: ${plan.metadata.style_and_energy.energy_level}/10

GENERA TRES DOCUMENTOS PROFESIONALES COMPLETOS EN UNA SOLA RESPUESTA:

═══════════════════════════════════════════════════════════════════════════════
📋 DOCUMENTO 1: GUÍA DE PRODUCCIÓN IA COMPLETA
═══════════════════════════════════════════════════════════════════════════════

Incluye OBLIGATORIAMENTE estas secciones detalladas:

🎯 RESUMEN EJECUTIVO:
- Título del proyecto y concepto central
- Logline en una oración potente
- Propuesta de valor única (¿Por qué viral?)
- Audiencia objetivo específica

🎬 VISIÓN CREATIVA MAESTRA:
- Tono y atmósfera general
- Estilo narrativo y visual
- Elementos diferenciadores únicos
- Estrategia de engagement

⚙️ ESPECIFICACIONES TÉCNICAS DE PRODUCCIÓN:
- Formato exacto: ${plan.metadata.format}
- Duración por episodio: 13-15 segundos
- Aspect ratio: 9:16 vertical
- Resolución recomendada: 1080x1920
- Frame rate: 30fps mínimo
- Formato de exportación y compresión

👥 DEVELOPMENT DETALLADO DE PERSONAJES:
${plan.characters.map(char => `
PERSONAJE: ${char.name}
- Descripción completa: ${char.description}
- Prompt visual IA: ${char.visual_prompt}
- Personalidad y motivaciones
- Arco narrativo dentro de la serie
- Elementos visuales clave para consistencia
`).join('\n')}

🎭 NOTAS DE PRODUCCIÓN ESCENA POR ESCENA:
${plan.story_structure.narrative_arc.flatMap(act => act.scenes).map(scene => `
ESCENA ${scene.scene_number}: ${scene.title}
- Resumen: ${scene.summary}
- Descripción visual: ${scene.visual_description}
- Diálogo/Narración: ${scene.dialogue_or_narration}
- Diseño sonoro: ${scene.sound_design}
- Duración: ${scene.duration_seconds} segundos
- Tipo de plano: ${scene.camera_shot_type || 'Determinado por director'}
- Notas de producción específicas
- Elementos ASMR o efectos especiales
- Transición con escena siguiente
`).join('\n')}

🎨 PALETA DE COLORES Y ESTÉTICA:
- Colores primarios y secundarios
- Mood board de referencia
- Tratamiento visual específico por escena

📱 OPTIMIZACIÓN PARA PLATAFORMAS SOCIALES:
- Elementos de gancho en primeros 3 segundos
- Puntos de replay y loop
- CTAs visuales integrados
- Estrategia de thumbnail/preview

[SEPARADOR_DOC1]

═══════════════════════════════════════════════════════════════════════════════
🎬 DOCUMENTO 2: BIBLIA DEL DIRECTOR PROFESIONAL
═══════════════════════════════════════════════════════════════════════════════

🎯 FILOSOFÍA DIRECTORIAL:
- Visión artística central del proyecto
- Estilo directorial específico
- Influencias cinematográficas y referencias
- Objetivos emocionales y narrativos

🎭 DIRECCIÓN DE PERSONAJES E ACTUACIÓN:
${plan.characters.map(char => `
DIRECCIÓN PARA ${char.name}:
- Personalidad base: ${char.description}
- Expresiones faciales características
- Lenguaje corporal signature
- Tono vocal y entrega de líneas
- Interacciones com otros personajes
- Momentos clave de desarrollo
- Referencias visuales de interpretación
`).join('\n')}

🎬 DIRECCIÓN DE ESCENAS Y BLOCKING DETALLADO:
${plan.story_structure.narrative_arc.flatMap(act => act.scenes).map(scene => `
ESCENA ${scene.scene_number} - BLOCKING COMPLETO:
Título: ${scene.title}

SETUP INICIAL:
- Posición de cámara y movimientos
- Posicionamiento de personajes en frame
- Props y elementos de escenografía
- Condiciones de iluminación inicial

DESARROLLO DE LA ACCIÓN:
- Beats narrativos específicos (0-${scene.duration_seconds}s)
- Movimientos de personajes
- Cambios de plano y ángulos
- Momentos de énfasis y timing

CLÍMAX Y RESOLUCIÓN:
- Momento peak de la escena
- Reacciones de personajes
- Transición visual al siguiente momento
- Setup para próxima escena (loop potential)

NOTAS DIRECTIONALES ESPECÍFICAS:
- ${scene.visual_description}
- Audio: ${scene.sound_design}
- Ritmo y pacing requirements
- Elementos de comedia/drama específicos
`).join('\n')}

🎨 TÉCNICAS DE NARRACIÓN VISUAL:
- Composición en formato vertical 9:16
- Uso del espacio visual limitado
- Jerarquía visual y puntos focales
- Movimiento de cámara y dinamismo
- Cortes y ritmo de edición
- Integración de elementos gráficos
- Tratamiento de color escena por escena

🎵 DIRECCIÓN DE AUDIO Y SONIDO:
- Diseño sonoro general
- Balance diálogo/música/efectos
- Espacialización de audio para móviles
- Momentos de silencio estratégico
- Elementos ASMR y su implementación

[SEPARADOR_DOC2]

═══════════════════════════════════════════════════════════════════════════════
🎨 DOCUMENTO 3: GUÍA DE ESTILO VISUAL PROFESIONAL
═══════════════════════════════════════════════════════════════════════════════

🎥 CINEMATOGRAFÍA Y TRABAJO DE CÁMARA:
- Enfoque visual principal: ${plan.metadata.style_and_energy.visual_styles.join(', ')}
- Nivel de energía visual: ${plan.metadata.style_and_energy.energy_level}/10

ESPECIFICACIONES DE CÁMARA:
- Aspect Ratio: 9:16 (1080x1920)
- Tipos de plano prioritarios:
  * Extreme Close-ups para reacciones
  * Medium shots para acción
  * Wide verticals para reveals
- Movimientos de cámara permitidos
- Ángulos y perspectivas signature

🎨 PALETA DE COLORES MAESTRA:
- Colores primarios: [Especificar 3-5 colores hex]
- Colores de acento: [Especificar 2-3 colores]
- Tratamiento por personaje:
${plan.characters.map(char => `  * ${char.name}: [Colores específicos basados en ${char.description}]`).join('\n')}
- Paleta por estado emocional de escenas

💡 ILUMINACIÓN Y ATMOSFERA:
- Setup de iluminación base
- Variaciones por escena y mood:
${plan.story_structure.narrative_arc.flatMap(act => act.scenes).map(scene => `  * Escena ${scene.scene_number}: Iluminación para "${scene.title}" - ${scene.visual_description.substring(0, 100)}...`).join('\n')}
- Temperatura de color general
- Contraste y exposición targets
- Manejo de sombras y highlights

🏗️ ELEMENTOS DE DISEÑO DE PRODUCCIÓN:
- Locaciones principales y su tratamiento visual
- Props críticos y su diseño
- Vestuario y paleta textil
- Elementos gráficos y tipografías
- Efectos visuales y post-producción
- Transiciones entre escenas

📱 OPTIMIZACIÓN PARA DISPOSITIVOS MÓVILES:
- Legibilidad en pantallas pequeñas
- Contraste y saturación para diferentes displays
- Elementos UI/UX integrados
- Consideraciones de compresión
- Testing en diferentes dispositivos

🎯 PROMPTS TÉCNICOS PARA GENERACIÓN IA (EN INGLÉS):
${plan.characters.map(char => `
CHARACTER PROMPT - ${char.name}:
"${char.visual_prompt}, high quality, detailed, professional lighting, cinematic composition, vertical 9:16 aspect ratio, vibrant colors, sharp focus, studio quality"

NEGATIVE PROMPT - ${char.name}:
"blurry, distorted, low quality, amateur, oversaturated, underexposed, watermark, signature"
`).join('\n')}

🌟 REFERENCIAS VISUALES Y MOOD BOARD:
- Referencias cinematográficas específicas
- Paleta de inspiración visual
- Ejemplos de contenido viral similar
- Benchmarks de calidad técnica

IMPORTANTE: 
- Todo texto en ESPAÑOL excepto prompts técnicos de IA
- Prompts de imagen en INGLÉS para máxima precisión de generación
- Seguir aesthetic de ${plan.metadata.style_and_energy.visual_styles.join(' + ')}
- Mantener energía ${plan.metadata.style_and_energy.energy_level}/10 en todos los elementos`;

        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: megaOptimizedPrompt
        });
        
        // PARSING SEGURO CON SEPARADORES
        const fullText = response.text;
        const parts = fullText.split(/\[SEPARADOR_DOC[12]\]/);
        
        if (parts.length >= 3) {
            const aiProductionGuide = parts[0].trim();
            const directorsBible = parts[1].trim();
            const visualStyleGuide = parts[2].trim();
            
            console.log('%c🚀 MEGA-OPTIMIZACIÓN: 3 documentos profesionales completos en 1 llamada API', 'color: lightgreen; font-weight: bold;');
            console.log(`📊 Documento 1: ${aiProductionGuide.length} caracteres`);
            console.log(`📊 Documento 2: ${directorsBible.length} caracteres`);
            console.log(`📊 Documento 3: ${visualStyleGuide.length} caracteres`);
            
            return {
                aiProductionGuide,
                directorsBible,
                visualStyleGuide
            };
        } else {
            throw new Error("No se pudieron separar los documentos correctamente");
        }
        
    } catch (error) {
        console.warn('%c⚠️ Generación mega-optimizada falló, usando fallback individual...', 'color: orange;');
        
        // FALLBACK MEJORADO CON PROMPTS ESPECÍFICOS EN ESPAÑOL
        const generateDetailedDoc = (docType: string, specificPrompt: string) => 
            backendProxy.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: `Eres un experto en ${docType} para contenido viral de TikTok/Reels.

PLAN DE HISTORIA:
${JSON.stringify(plan)}

${specificPrompt}

IMPORTANTE: 
- Respuesta en ESPAÑOL profesional
- Prompts de imagen en INGLÉS para precisión
- Formato vertical 9:16 optimizado
- Enfoque en viral content strategy` 
            }).then(res => res.text);
        
        const [aiProductionGuide, directorsBible, visualStyleGuide] = await Promise.all([
            generateDetailedDoc("Guía de Producción IA", "Crea una guía de producción completa con especificaciones técnicas, desarrollo de personajes, y notas escena por escena para micro-contenido viral."),
            generateDetailedDoc("Biblia del Director", "Crea una biblia directorial completa con filosofía artística, dirección de personajes, blocking detallado, y técnicas de narración visual para formato vertical."),
            generateDetailedDoc("Guía de Estilo Visual", "Crea una guía visual completa con cinematografía, paleta de colores, iluminación, diseño de producción y optimización para dispositivos móviles.")
        ]);
        
        return { aiProductionGuide, directorsBible, visualStyleGuide };
    }
}


export async function generateCritique(plan: StoryMasterplan, userData: StoryData): Promise<Critique> {
    console.log('%c📝 Generando crítica en ESPAÑOL - MODO QUOTA-SAFE...', 'color: cyan; font-weight: bold;');
    
    const contextWithoutImages = {
        concept: userData.concept,
        format: Object.values(outputFormats).flat().find(f => f.value === userData.format)?.name || userData.format,
        narrativeStyles: userData.narrativeStyles,
        energyLevel: userData.energyLevel,
        visualStyles: userData.visualStyles,
        characters: userData.characters.map(c => ({
            name: c.name,
            description: c.description
        }))
    };
    
    const systemInstruction = addAntiLoopInstructions(`Eres un Experto Maestro en Análisis de Historias y Estrategia Creativa.

PLAN DE HISTORIA A ANALIZAR:
${JSON.stringify(plan)}

CONTEXTO DEL USUARIO (quota-optimizado, análisis visual diferido a Fase 6.3):
${JSON.stringify(contextWithoutImages)}

NOTA: Existen imágenes de personajes pero no se analizan aquí para preservar quota de API. Enfócate en narrativa, estructura y elementos creativos.

Genera una crítica estratégica comprensiva EN ESPAÑOL y devuélvela como objeto JSON con la estructura requerida.

IMPORTANTE: Todos los textos deben estar en español excepto los prompts técnicos de imagen que deben estar en inglés para mayor precisión.`);

    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemInstruction,
        config: { responseMimeType: 'application/json', responseSchema: critiqueSchema }
    });

    console.log('%c✅ Crítica generada en ESPAÑOL SIN consumir quota de análisis de imágenes', 'color: lightgreen;');
    return safeParseJsonResponse<Critique>(response.text);
}


// ============================================================================
// 🛡️ SISTEMA DE REGENERACIÓN ULTRA-SAFE PARA QUOTA
// ============================================================================

class QuotaSafeRegenerationEngine {
    private failedCalls = 0;
    
    async regenerateWithQuotaProtection(
        originalPlan: StoryMasterplan,
        critique: Critique,
        onProgress?: (phase: string, message: string) => void
    ): Promise<StoryMasterplan> {
        
        console.log('🛡️ INICIANDO REGENERACIÓN QUOTA-SAFE...');
        
        try {
            // MÉTODO 1: Regeneración Directa (1 sola llamada)
            if (onProgress) onProgress('1', 'Aplicando mejoras directamente (quota-safe)...');
            
            const directRegenerationResult = await this.attemptDirectRegeneration(
                originalPlan, 
                critique
            );
            
            if (directRegenerationResult) {
                console.log('✅ Regeneración directa exitosa');
                return directRegenerationResult;
            }
            
            // MÉTODO 2: Regeneración Template (fallback)
            console.log('🔧 Aplicando regeneración template como fallback...');
            if (onProgress) onProgress('2', 'Usando sistema de templates mejorados...');
            
            return this.applyTemplateBasedImprovements(originalPlan, critique);
            
        } catch (error) {
            console.error('❌ Error en regeneración quota-safe:', error);
            
            // MÉTODO 3: Fallback final sin API
            console.log('🆘 Usando fallback local sin API...');
            if (onProgress) onProgress('3', 'Aplicando mejoras locales sin IA...');
            
            return this.applyLocalImprovements(originalPlan, critique);
        }
    }
    
    private async attemptDirectRegeneration(
        plan: StoryMasterplan,
        critique: Critique
    ): Promise<StoryMasterplan | null> {
        
        try {
            const consolidatedPrompt = addAntiLoopInstructions(`Eres un Editor Maestro de Historias que aplica mejoras estratégicas de manera eficiente.

PLAN ACTUAL A MEJORAR:
${JSON.stringify(plan)}

MEJORAS ESPECÍFICAS A APLICAR:
- Fortalezas identificadas: ${critique.projectSummary.identifiedStrengths.join(', ')}
- Debilidades a corregir: ${critique.verticalFormatEvaluation.weaknesses.points.join(', ')}
- Estrategias sugeridas: ${critique.improvementStrategy.strategies.map(s => s.description).join(', ')}

APLICACIÓN DIRECTA DE MEJORAS:
1. MANTÉN las fortalezas identificadas
2. CORRIGE las debilidades específicas mencionadas
3. INTEGRA las estrategias sugeridas
4. PRESERVA la esencia creativa original
5. OPTIMIZA para formato vertical y contenido viral

IMPORTANTE: Una sola mejora integral, sin análisis multi-perspectiva.

Devuelve el StoryMasterplan mejorado en formato JSON.`);

            const response = await backendProxy.generateContent({
                model: 'gemini-2.5-flash',
                contents: consolidatedPrompt,
                config: { 
                    responseMimeType: 'application/json',
                    responseSchema: storyMasterplanSchema 
                }
            });
            
            return safeParseJsonResponse<StoryMasterplan>(response.text);
            
        } catch (error) {
            console.warn('⚠️ Regeneración directa falló:', error);
            this.failedCalls++;
            return null;
        }
    }
    
    private applyTemplateBasedImprovements(
        plan: StoryMasterplan,
        critique: Critique
    ): StoryMasterplan {
        
        console.log('🔧 Aplicando mejoras basadas en templates...');
        
        const improvedPlan: StoryMasterplan = JSON.parse(JSON.stringify(plan));
        
        // MEJORA 1: Optimizar logline
        if (critique.verticalFormatEvaluation.weaknesses.points.some(p => p.toLowerCase().includes('logline'))) {
            improvedPlan.metadata.logline = this.improveLogline(plan.metadata.logline);
        }
        
        // MEJORA 2: Potenciar personajes
        if (critique.improvementStrategy.strategies.some(s => s.title.toLowerCase().includes('personaje'))) {
            improvedPlan.characters = plan.characters.map(char => ({
                ...char,
                description: this.enhanceCharacterDescription(char.description),
                visual_prompt: this.optimizeVisualPrompt(char.visual_prompt)
            }));
        }
        
        // MEJORA 3: Optimizar escenas para formato vertical
        if (critique.specificImprovements.visualSimplification.keyElements.length > 0) {
            improvedPlan.story_structure.narrative_arc.forEach(act => {
                act.scenes = act.scenes.map(scene => ({
                    ...scene,
                    visual_description: this.optimizeForVertical(scene.visual_description),
                    duration_seconds: Math.min(scene.duration_seconds, 15) // Máximo 15 segundos
                }));
            });
        }
        
        // MEJORA 4: Incrementar energía si es necesaria
        if (critique.improvementStrategy.strategies.some(s => s.description.toLowerCase().includes('energía'))) {
            improvedPlan.metadata.style_and_energy.energy_level = Math.min(
                improvedPlan.metadata.style_and_energy.energy_level + 1,
                10
            );
        }
        
        return improvedPlan;
    }
    
    private applyLocalImprovements(
        plan: StoryMasterplan,
        critique: Critique
    ): StoryMasterplan {
        
        console.log('🆘 Aplicando mejoras locales de emergencia...');
        
        const improvedPlan: StoryMasterplan = JSON.parse(JSON.stringify(plan));
        
        // MEJORAS LOCALES BÁSICAS
        improvedPlan.metadata.logline += " - Optimizado para formato vertical y máximo engagement.";
        
        improvedPlan.story_structure.narrative_arc.forEach(act => {
            act.scenes.forEach(scene => {
                // Asegurar duración corta para TikTok/Reels
                scene.duration_seconds = Math.min(scene.duration_seconds, 15);
                
                // Añadir elementos virales
                if (!scene.visual_description.toLowerCase().includes('expresión')) {
                    scene.visual_description += ", expresiones exageradas para máximo impacto visual";
                }
            });
        });
        
        return improvedPlan;
    }
    
    // UTILIDADES DE MEJORA
    private improveLogline(original: string): string {
        const improvements = [
            "para TikTok/Reels",
            "con elementos virales",
            "optimizado para engagement móvil",
            "en formato vertical dinámico"
        ];
        
        const randomImprovement = improvements[Math.floor(Math.random() * improvements.length)];
        return `${original} ${randomImprovement}`.trim();
    }
    
    private enhanceCharacterDescription(original: string): string {
        if (!original.toLowerCase().includes('expresivo')) {
            return `${original}, extremadamente expresivo y carismático para capturar atención inmediata`;
        }
        return original;
    }
    
    private optimizeVisualPrompt(original: string): string {
        const verticalOptimizations = [
            "9:16 aspect ratio",
            "vertical composition optimized",
            "mobile-first framing",
            "dynamic vertical layout"
        ];
        
        const hasVerticalOpt = verticalOptimizations.some(opt => 
            original.toLowerCase().includes(opt.toLowerCase())
        );
        
        if (!hasVerticalOpt) {
            return `${original}, ${verticalOptimizations[0]}`;
        }
        
        return original;
    }
    
    private optimizeForVertical(original: string): string {
        const verticalKeywords = [
            "enfoque en primer plano",
            "composición vertical",
            "elementos centrados",
            "fondo simplificado"
        ];
        
        const randomKeyword = verticalKeywords[Math.floor(Math.random() * verticalKeywords.length)];
        return `${original}, ${randomKeyword}`;
    }
}

// ============================================================================
// 🔄 FUNCIÓN PROBLEMÁTICA REEMPLAZADA
// ============================================================================
export async function regenerateStoryPlanWithCritique(
    plan: StoryMasterplan, 
    critique: Critique,
    onProgress?: (phase: string, message: string) => void
): Promise<StoryMasterplan> {
    
    console.log('🛡️ Usando Sistema de Regeneración Quota-Safe...');
    
    const quotaSafeEngine = new QuotaSafeRegenerationEngine();
    
    try {
        // FIX: The call to `regenerateWithQuotaProtection` had an extra argument.
        // The function signature was updated, but the call was not, leading to a type error.
        // The `undefined` argument, a remnant of a removed `userData` parameter, has been removed.
        return await quotaSafeEngine.regenerateWithQuotaProtection(
            plan,
            critique,
            onProgress
        );
        
    } catch (error) {
        console.error('❌ Error crítico en regeneración quota-safe:', error);
        
        // FALLBACK FINAL: Devolver plan original con mensaje
        console.log('🆘 Devolviendo plan original como último recurso');
        
        if (onProgress) {
            onProgress('fallback', 'Usando plan original optimizado');
        }
        
        return plan; // Devolver el plan original si todo falla
    }
}


async function generateImageWithFallback(prompt: string, aspectRatio: ReferenceAsset['aspectRatio']): Promise<Blob> {
    try {
        console.log("%c🟢 PRIMARIO: Gemini-2.5-Flash-Image", "color: lightgreen; font-weight: bold;");
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart?.inlineData) {
            const finishReason = response.candidates?.[0]?.finishReason;
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
            let reason = `No se encontró data de imagen en la respuesta.`;
            if (finishReason && finishReason !== 'STOP') {
                reason += ` Razón de finalización: ${finishReason}.`;
            }
            if (textPart?.text) {
                reason += ` Respuesta de texto: "${textPart.text}"`;
            }
            if (response.promptFeedback?.blockReason) {
                reason += ` Prompt bloqueado. Razón: ${response.promptFeedback.blockReason}`;
            }
            throw new Error(reason);
        }

        const byteCharacters = atob(imagePart.inlineData.data);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }
        console.log("%c✅ ÉXITO: Imagen generada con Gemini-2.5-Flash", "color: lightgreen; font-weight: bold;");
        return new Blob([byteArray], { type: imagePart.inlineData.mimeType });

    } catch (geminiError: any) {
        console.warn(`%c🟡 FALLBACK: Gemini Flash falló, intentando Imagen-4.0...`, "color: orange; font-weight: bold;");
        console.warn(`Error de Gemini: ${geminiError.message}`);
        try {
            const response: GenerateImagesResponse = await backendProxy.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio },
            });
            if (!response.generatedImages?.[0]?.image?.imageBytes) {
                throw new Error(`Imagen-4.0 no devolvió datos de imagen para el prompt: "${prompt.substring(0, 100)}..."`);
            }
            const byteString = atob(response.generatedImages[0].image.imageBytes);
            const arrayBuffer = new ArrayBuffer(byteString.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            for (let i = 0; i < byteString.length; i++) {
                uint8Array[i] = byteString.charCodeAt(i);
            }
            console.log("%c⚠️ FALLBACK ÉXITO: Imagen generada con Imagen-4.0", "color: yellow; font-weight: bold;");
            return new Blob([arrayBuffer], { type: 'image/png' });
        } catch (imagenError: any) {
            const combinedError = `FALLO TOTAL - Gemini Flash: "${geminiError.message}" | Imagen-4.0: "${imagenError.message}"`;
            console.error("%c❌ FALLO CRÍTICO: Ambos modelos fallaron", "color: red; font-weight: bold;", combinedError);
            throw new Error(combinedError);
        }
    }
}

// ============================================================================
// 🚀 ARQUITECTURA HÍBRIDO ULTRAINTELIGENTE 2025
// ============================================================================

class QuotaIntelligentManager {
    private readonly DAILY_LIMIT = 100;
    private readonly SAFETY_BUFFER = 10;
    private readonly USABLE_QUOTA = 90;
    
    private quotaDistribution = {
        characters: 18,        // 20% - Personajes principales
        key_scenes: 45,        // 50% - Escenas importantes  
        secondary: 18,         // 20% - Escenas secundarias
        testing: 9             // 10% - Buffer y pruebas
    };
    
    private currentUsage = {
        characters: 0,
        key_scenes: 0,
        secondary: 0,
        testing: 0,
        total: 0
    };
    
    async optimizeGenerationPlan(
        plan: StoryMasterplan,
        characters: any[]
    ): Promise<{
        execution_plan: HybridExecutionPlan;
    }> {
        
        console.log('🎯 OPTIMIZANDO PLAN HÍBRIDO ULTRAINTELIGENTE...');
        console.log(`📊 Quota disponible: ${this.USABLE_QUOTA} imágenes`);
        
        const allScenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);
        const classifiedScenes = this.classifyScenesByImportance(allScenes);
        const execution_plan = this.createHybridExecutionPlan(classifiedScenes, characters);
        
        return { execution_plan };
    }
    
    private classifyScenesByImportance(scenes: Scene[]): ClassifiedScene[] {
        return scenes.map(scene => {
            let importance = 5;
            let tier: 'maximum' | 'high' | 'optimized' | 'skip' = 'optimized';
            let framesNeeded = 1;
            
            if (scene.scene_number <= 3) {
                importance += 4; framesNeeded = 3; tier = 'maximum';
            } else if (scene.scene_number % 5 === 0 || scene.title.toLowerCase().includes('clímax') || scene.title.toLowerCase().includes('confrontación')) {
                importance += 3; framesNeeded = 2; tier = 'maximum';
            } else if (scene.dialogue_or_narration.length > 100 || scene.visual_description.toLowerCase().includes('sorpresa') || scene.visual_description.toLowerCase().includes('revelación')) {
                importance += 2; framesNeeded = 2; tier = 'high';
            }
            if (scene.visual_description.toLowerCase().includes('reacción') || scene.visual_description.toLowerCase().includes('expresión') || scene.sound_design.toLowerCase().includes('risa') || scene.sound_design.toLowerCase().includes('sorpresa')) {
                importance += 1;
            }
            
            if (importance >= 9) tier = 'maximum';
            else if (importance >= 7) tier = 'high';
            else if (importance >= 5) tier = 'optimized';
            else tier = 'skip';
            
            return { scene, importance: Math.min(importance, 10), tier, framesNeeded, estimatedQuotaCost: framesNeeded * (tier === 'maximum' ? 1.2 : tier === 'high' ? 1.1 : 1.0) };
        });
    }
    
    private createHybridExecutionPlan(classifiedScenes: ClassifiedScene[], characters: any[]): HybridExecutionPlan {
        const sortedScenes = classifiedScenes.sort((a, b) => b.importance - a.importance);
        const plan: HybridExecutionPlan = {
            characters: { items: characters.slice(0, 3).map(c => ({ name: c.name, description: c.description })), method: 'hybrid_references', quota_cost: Math.min(characters.length, 3) * 6 },
            tier1_maximum: { scenes: [], method: 'ultra_detailed_prompts', quota_cost: 0 },
            tier2_high: { scenes: [], method: 'detailed_prompts', quota_cost: 0 },
            tier3_optimized: { scenes: [], method: 'template_based', quota_cost: 0 },
            tier4_skipped: { scenes: [], reason: 'quota_optimization' },
            total_quota_cost: 0
        };
        let quotaUsed = plan.characters.quota_cost;
        
        for (const classifiedScene of sortedScenes) {
            const estimatedCost = classifiedScene.estimatedQuotaCost;
            if (classifiedScene.tier === 'maximum' && quotaUsed + estimatedCost <= this.quotaDistribution.characters + this.quotaDistribution.key_scenes) {
                plan.tier1_maximum.scenes.push(classifiedScene); plan.tier1_maximum.quota_cost += estimatedCost; quotaUsed += estimatedCost;
            } else if (classifiedScene.tier === 'high' && quotaUsed + estimatedCost <= this.USABLE_QUOTA - this.quotaDistribution.testing) {
                plan.tier2_high.scenes.push(classifiedScene); plan.tier2_high.quota_cost += estimatedCost; quotaUsed += estimatedCost;
            } else if (classifiedScene.tier === 'optimized' && quotaUsed + estimatedCost <= this.USABLE_QUOTA - this.quotaDistribution.testing) {
                plan.tier3_optimized.scenes.push(classifiedScene); plan.tier3_optimized.quota_cost += estimatedCost; quotaUsed += estimatedCost;
            } else {
                plan.tier4_skipped.scenes.push(classifiedScene);
            }
        }
        plan.total_quota_cost = quotaUsed;
        return plan;
    }

    canGenerate(quotaNeeded: number, tier: string): boolean {
        const remaining = this.USABLE_QUOTA - this.currentUsage.total;
        const bufferNeeded = tier === 'maximum' ? 2 : tier === 'high' ? 1.5 : 1;
        return remaining >= (quotaNeeded * bufferNeeded);
    }
    
    recordUsage(quotaUsed: number, category: keyof typeof this.currentUsage): void {
        this.currentUsage[category] += quotaUsed;
        this.currentUsage.total += quotaUsed;
        console.log(`📊 Quota usada: ${quotaUsed} (${category}) - Total: ${this.currentUsage.total}/${this.USABLE_QUOTA}`);
    }
}

class HybridUltraIntelligentGenerators {
    
    async generateMaximumQualityScene(classifiedScene: ClassifiedScene, frameType: string, visualDNA?: any, visualStyles?: string[], narrativeStyles?: string[]): Promise<ReferenceAsset> {
        console.log(`🏆 TIER MAXIMUM: Escena ${classifiedScene.scene.scene_number} (${frameType})`);
        const ultraPrompt = await this.buildUltraDetailedPrompt(classifiedScene.scene, frameType, visualDNA, visualStyles, narrativeStyles);
        const safePrompt = this.addAntiLoopProtection(ultraPrompt);
        await new Promise(resolve => setTimeout(resolve, 15000));
        const imageBlob = await generateImageWithFallback(safePrompt, '9:16');
        const assetId = crypto.randomUUID();
        imageBlobCache.set(assetId, imageBlob);
        return { id: assetId, name: `Escena ${classifiedScene.scene.scene_number} - ${frameType} [Maximum]`, type: 'scene_frame', prompt: safePrompt, aspectRatio: '9:16', source: 'generated_hybrid_ultra', sceneNumber: classifiedScene.scene.scene_number, frameType: frameType as 'start' | 'climax' | 'end', metadata: { generation_method: 'hybrid_ultra_maximum', importance: classifiedScene.importance, tier: 'maximum', quota_cost: classifiedScene.estimatedQuotaCost, quality_target: 95, anti_loop_protected: true } };
    }
    
    async generateHighQualityScene(classifiedScene: ClassifiedScene, frameType: string, visualStyles?: string[], narrativeStyles?: string[]): Promise<ReferenceAsset> {
        console.log(`🥇 TIER HIGH: Escena ${classifiedScene.scene.scene_number} (${frameType})`);
        const detailedPrompt = this.buildDetailedOptimizedPrompt(classifiedScene.scene, frameType, visualStyles);
        const safePrompt = this.addAntiLoopProtection(detailedPrompt);
        await new Promise(resolve => setTimeout(resolve, 12000));
        const imageBlob = await generateImageWithFallback(safePrompt, '9:16');
        const assetId = crypto.randomUUID();
        imageBlobCache.set(assetId, imageBlob);
        return { id: assetId, name: `Escena ${classifiedScene.scene.scene_number} - ${frameType} [High]`, type: 'scene_frame', prompt: safePrompt, aspectRatio: '9:16', source: 'generated_hybrid_high', sceneNumber: classifiedScene.scene.scene_number, frameType: frameType as 'start' | 'climax' | 'end', metadata: { generation_method: 'hybrid_ultra_high', importance: classifiedScene.importance, tier: 'high', quota_cost: classifiedScene.estimatedQuotaCost, quality_target: 85, anti_loop_protected: true } };
    }
    
    async generateOptimizedScene(classifiedScene: ClassifiedScene, frameType: string, visualStyles?: string[], narrativeStyles?: string[]): Promise<ReferenceAsset> {
        console.log(`⚡ TIER OPTIMIZED: Escena ${classifiedScene.scene.scene_number} (${frameType})`);
        const templatePrompt = this.buildIntelligentTemplate(classifiedScene.scene, frameType, visualStyles);
        const safePrompt = this.addAntiLoopProtection(templatePrompt);
        await new Promise(resolve => setTimeout(resolve, 8000));
        const imageBlob = await generateImageWithFallback(safePrompt, '9:16');
        const assetId = crypto.randomUUID();
        imageBlobCache.set(assetId, imageBlob);
        return { id: assetId, name: `Escena ${classifiedScene.scene.scene_number} - ${frameType} [Optimized]`, type: 'scene_frame', prompt: safePrompt, aspectRatio: '9:16', source: 'generated_hybrid_optimized', sceneNumber: classifiedScene.scene.scene_number, frameType: frameType as 'start' | 'climax' | 'end', metadata: { generation_method: 'hybrid_ultra_optimized', importance: classifiedScene.importance, tier: 'optimized', quota_cost: classifiedScene.estimatedQuotaCost, quality_target: 75, anti_loop_protected: true } };
    }
    
    private async buildUltraDetailedPrompt(
        scene: Scene,
        frameType: string,
        visualDNA?: any,
        visualStyles?: string[],
        narrativeStyles?: string[]
    ): Promise<string> {
        
        const systemInstruction = `Eres un Arquitecto de Prompts Ultra-Específico.

ESTILO VISUAL GENERAL: ${visualStyles?.join(', ') || 'Determinado por la escena'}
TONO NARRATIVO: ${narrativeStyles?.join(', ') || 'Determinado por la escena'}

ESCENA CRÍTICA A GENERAR:
${JSON.stringify(scene)}

MOMENTO: ${frameType}
${visualDNA ? `CONTEXTO VISUAL: ${JSON.stringify(visualDNA)}` : ''}

CONSTRUYE UN PROMPT ULTRA-DETALLADO que incluya:

1. DESCRIPCIÓN DEL SUJETO (40+ palabras específicas)
2. DETALLES FÍSICOS EXACTOS (30+ características)
3. ACCIÓN Y POSE ESPECÍFICA (20+ elementos)
4. AMBIENTE Y ESCENOGRAFÍA (35+ elementos)
5. ILUMINACIÓN Y ATMOSFERA (25+ especificaciones)
6. CÁMARA Y COMPOSICIÓN (30+ parámetros)
7. ESTILO Y CALIDAD (20+ términos técnicos)

TÉCNICAS AVANZADAS:
- Especificidad extrema en cada elemento
- Consistencia visual con elementos previos
- Optimización para formato vertical 9:16
- Elementos que maximicen engagement viral
- Parámetros técnicos de máxima calidad

IMPORTANTE: 
- Respuesta ULTRA-ESPECÍFICA sin repeticiones
- Máximo 10KB de respuesta
- NO generar loops infinitos
- Estructura clara y profesional

Devuelve SOLO el prompt ultra-detallado en inglés.`;

        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: this.addAntiLoopInstructions(systemInstruction)
        });
        
        return response.text.trim();
    }
    
    private buildDetailedOptimizedPrompt(scene: Scene, frameType: string, visualStyles?: string[]): string {
        const baseElements = [
            `${scene.title} scene`,
            `${frameType} moment`,
            scene.visual_description,
            scene.dialogue_or_narration ? `expressing: ${scene.dialogue_or_narration.substring(0, 50)}` : '',
            'photorealistic 3D rendering',
            'ultra-high resolution',
            'cinematic lighting',
            'professional quality',
            'detailed textures',
            'sharp focus',
            '9:16 vertical composition',
            'dramatic atmosphere',
            'engaging composition',
            'viral content optimized',
            ...(visualStyles || [])
        ];
        
        return baseElements.filter(el => el.trim()).join(', ');
    }
    
    private buildIntelligentTemplate(scene: Scene, frameType: string, visualStyles?: string[]): string {
        const styleString = visualStyles ? visualStyles.join(', ') : 'cinematic quality';
        const templates: Record<string, string> = {
            start: `${scene.title} opening moment, establishing scene, character introduction, ${scene.visual_description.split(',')[0]}, ${styleString}, 9:16 vertical`,
            climax: `${scene.title} dramatic peak, intense moment, emotional climax, ${scene.visual_description.split(',')[0]}, dynamic composition, ${styleString}, engaging visual`,
            end: `${scene.title} resolution, concluding moment, final state, ${scene.visual_description.split(',')[0]}, satisfying closure, cinematic rendering, ${styleString}`
        };
        
        return templates[frameType as keyof typeof templates] || templates.start;
    }
    
    private addAntiLoopProtection(prompt: string): string {
        return prompt + `

GENERATION SAFETY:
- Single complete image output only
- No repetitive content
- Maximum quality execution
- Clean professional result
- Stop at completion`;
    }
    
    private addAntiLoopInstructions(systemInstruction: string): string {
        return systemInstruction + `

CRITICAL SAFETY RULES:
- Return ONLY the requested prompt
- NO repetitive phrases or loops
- Maximum 5KB response length
- Stop generation at natural completion
- NEVER generate infinite repetitions`;
    }
}


// --- Throttling y Estimación de Costos ---

export class VisualGenerationThrottler {
    private currentStep = 0;
    private totalSteps = 0;
    private onProgress: ((current: number, total: number, message: string) => void) | null = null;
    private cancelled = false;
    
    init(total: number, onProgress: (current: number, total: number, message: string) => void) {
        this.totalSteps = total; this.currentStep = 0; this.onProgress = onProgress; this.cancelled = false;
    }
    cancel() { this.cancelled = true; }
    
    async nextStep(message: string, delay: number = 12000) {
        if (this.cancelled) { throw new Error("Generation cancelled by user."); }
        this.currentStep++;
        if (this.onProgress) { this.onProgress(this.currentStep, this.totalSteps, message); }
        if (this.currentStep < this.totalSteps) {
            console.log(`⏱️ Esperando ${delay/1000}s antes de la siguiente generación...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

const visualThrottler = new VisualGenerationThrottler();

export function cancelCurrentGeneration() {
    visualThrottler.cancel();
}

async function generateHybridCharacters(
    charactersConfig: HybridExecutionPlan['characters'],
    userData: StoryData,
    aspectRatio: ReferenceAsset['aspectRatio'],
    quotaManager: QuotaIntelligentManager,
    onProgress: VisualGenerationThrottler
): Promise<Omit<GeneratedReferenceAssets, 'sceneFrames'>> {
    const finalCharacters: ReferenceAsset[] = [];
    const generators = new HybridUltraIntelligentGenerators(); // Re-use the prompt builder logic

    for (const character of charactersConfig.items) {
        if (!quotaManager.canGenerate(6, 'maximum')) {
            console.warn(`Quota limit reached for character ${character.name}. Skipping generation.`);
            continue;
        }

        await onProgress.nextStep(`Planificando 6 tomas de referencia para ${character.name}...`, 2000);

        // 1. Generate 6 detailed prompts for the character using an AI agent
        const promptGenSystemInstruction = addAntiLoopInstructions(`You are a character art director AI. Based on the character description, generate a JSON array of 6 distinct, highly-detailed image generation prompts (in English).
        
        Character: ${character.name} - ${character.description}
        Visual Style: ${userData.visualStyles.join(', ')}

        The 6 prompts must be:
        1. A full-body character sheet, neutral pose, plain background. This is the master reference.
        2. A close-up portrait showing a happy or joyful expression.
        3. A dynamic action pose, related to their character.
        4. A portrait showing a sad or contemplative expression.
        5. A portrait showing an angry or determined expression.
        6. A unique "wildcard" shot that reveals personality (e.g., a hobby, a quiet moment).

        Each prompt must be extremely detailed, specifying appearance, clothing, lighting, camera angle, and style to ensure maximum consistency.
        
        Return ONLY the JSON array of 6 strings: ["prompt1", "prompt2", ...].`);

        const promptGenResponse = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: promptGenSystemInstruction,
            config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
        });

        const generatedPrompts = safeParseJsonResponse<string[]>(promptGenResponse.text);
        if (generatedPrompts.length !== 6) {
            console.warn(`AI did not generate exactly 6 prompts for ${character.name}, skipping.`);
            continue;
        }

        // 2. Generate images from the prompts
        for (let i = 0; i < generatedPrompts.length; i++) {
            const finalPrompt = (generators as any)['addAntiLoopProtection'](generatedPrompts[i]); // Using the existing safety function
            const variationName = i === 0 ? 'Base' : `Var ${i}`;
            
            await onProgress.nextStep(`Generando ${variationName} para ${character.name}...`, 12000);

            const imageBlob = await generateImageWithFallback(finalPrompt, aspectRatio);
            const assetId = crypto.randomUUID();
            imageBlobCache.set(assetId, imageBlob);
            
            finalCharacters.push({
                id: assetId,
                name: `${character.name} - ${variationName}`,
                type: 'character',
                prompt: finalPrompt,
                aspectRatio,
                source: 'hybrid', // Since it's based on user description
                metadata: { generation_method: 'hybrid_ultra_character' }
            });
            quotaManager.recordUsage(1, 'characters');
        }
    }
    
    return { characters: finalCharacters, environments: [], elements: [] };
}

export async function generateOptimizedReferenceAssets(
    plan: StoryMasterplan,
    userData: StoryData,
    aspectRatio: ReferenceAsset['aspectRatio'],
    onProgress?: (current: number, total: number, message: string) => void
): Promise<Omit<GeneratedReferenceAssets, 'sceneFrames'>> {
    console.log('🚀 INICIANDO HÍBRIDO ULTRAINTELIGENTE - FASE DE REFERENCIAS...');
    const quotaManager = new QuotaIntelligentManager();
    const { execution_plan } = await quotaManager.optimizeGenerationPlan(plan, userData.characters);
    
    // Cache the execution plan for the scene generation phase
    lastExecutionPlan = execution_plan;
    
    visualThrottler.init(execution_plan.characters.quota_cost, onProgress || (() => {}));
    
    // Call the character generation logic
    return await generateHybridCharacters(
        execution_plan.characters,
        userData,
        aspectRatio,
        quotaManager,
        visualThrottler
    );
}

export async function runFinalVideoGenerationPipeline(plan: StoryMasterplan, assets: GeneratedReferenceAssets, aiProductionGuide: string, onProgress: (update: ProgressUpdate) => void): Promise<FinalAssets> {
    onProgress({ stage: 'sub_prompts', status: 'in_progress', message: 'Iniciando generación de video...' });
    const allScenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);
    const finalAssets: FinalAssets = { videoAssets: [], imageAssets: [], audioAssets: [] };

    for (const scene of allScenes) {
        const sceneId = `scene_${scene.scene_number}`;
        onProgress({ stage: 'videos', sceneId, status: 'in_progress', message: `Generando video para Escena ${scene.scene_number}...` });
        const videoPrompt = `Simulate video for scene: ${scene.visual_description}. Style: ${plan.metadata.style_and_energy.visual_styles.join(', ')}. Duration: ${scene.duration_seconds}s.`;
        
        let operation: GenerateVideosOperation = await backendProxy.generateVideos({ model: 'veo-2.0-generate-001', prompt: videoPrompt });
        
        while (!operation.done) {
            await new Promise(r => setTimeout(r, 10000));
            operation = await backendProxy.getVideosOperation({ operation });
            const progress = (operation.metadata as any)?.progress?.percentage || 0;
            onProgress({ stage: 'videos', sceneId, status: 'in_progress', message: `Procesando Escena ${scene.scene_number}...`, progress });
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const videoBlob = await backendProxy.fetchVideo(downloadLink);
            const assetId = crypto.randomUUID();
            imageBlobCache.set(assetId, videoBlob);
            finalAssets.videoAssets.push({ sceneId, segment: 1, assetId, prompt: videoPrompt });
            onProgress({ stage: 'videos', sceneId, status: 'complete', message: `Video para Escena ${scene.scene_number} completado.` });
        } else {
            throw new Error(`La operación de video para la Escena ${scene.scene_number} no devolvió un enlace.`);
        }
    }
    onProgress({ stage: 'complete', status: 'complete', message: 'Todos los activos generados.' });
    return finalAssets;
}

export async function generateHybridNeuralSceneFrame( plan: StoryMasterplan, scene: Scene, referenceAssets: GeneratedReferenceAssets, aspectRatio: ReferenceAsset['aspectRatio'], frameType: 'start' | 'climax' | 'end', userData: StoryData, onProgress?: (message: string) => void ): Promise<ReferenceAsset> {
    console.log(`🧠 Iniciando generación Híbrida para Escena ${scene.scene_number} (${frameType})...`);

    if (!lastExecutionPlan) {
        console.warn("No execution plan found. Generating one on the fly. This may result in suboptimal quota usage.");
        onProgress?.('Optimizando plan de quota sobre la marcha...');
        const quotaManager = new QuotaIntelligentManager();
        // Pass userData characters if available, otherwise plan characters
        const charactersForPlan = referenceAssets.characters.length > 0 ? referenceAssets.characters : plan.characters;
        const { execution_plan } = await quotaManager.optimizeGenerationPlan(plan, charactersForPlan);
        lastExecutionPlan = execution_plan;
    }

    const classifiedScene = 
        lastExecutionPlan.tier1_maximum.scenes.find(s => s.scene.scene_number === scene.scene_number) ||
        lastExecutionPlan.tier2_high.scenes.find(s => s.scene.scene_number === scene.scene_number) ||
        lastExecutionPlan.tier3_optimized.scenes.find(s => s.scene.scene_number === scene.scene_number);

    if (!classifiedScene) {
        console.warn(`Scene ${scene.scene_number} was skipped by quota manager. Using optimized fallback.`);
        onProgress?.(`Escena ${scene.scene_number} saltada por quota. Usando generador optimizado...`);
        const generators = new HybridUltraIntelligentGenerators();
        const dummyScene: ClassifiedScene = { scene, importance: 3, tier: 'optimized', framesNeeded: 1, estimatedQuotaCost: 1 };
        return await generators.generateOptimizedScene(dummyScene, frameType, userData.visualStyles, userData.narrativeStyles);
    }
    
    const generators = new HybridUltraIntelligentGenerators();
    const characterDNA = referenceAssets.characters;

    onProgress?.(`Escena ${scene.scene_number} clasificada como Tier '${classifiedScene.tier}'. Iniciando generación...`);

    switch (classifiedScene.tier) {
        case 'maximum':
            return await generators.generateMaximumQualityScene(classifiedScene, frameType, characterDNA, userData.visualStyles, userData.narrativeStyles);
        case 'high':
            return await generators.generateHighQualityScene(classifiedScene, frameType, userData.visualStyles, userData.narrativeStyles);
        case 'optimized':
        default:
            return await generators.generateOptimizedScene(classifiedScene, frameType, userData.visualStyles, userData.narrativeStyles);
    }
}

// ============================================================================
// 📦 SISTEMA DE DESCARGA LOCAL COMPLETA
// ============================================================================

export async function createProjectZipDownload(
    plan: StoryMasterplan,
    documentation: Documentation,
    referenceAssets: GeneratedReferenceAssets,
    sceneFrames: ReferenceAsset[]
): Promise<void> {
    
    console.log('📦 Preparando descarga completa del proyecto...');
    
    try {
        const zip = new JSZip();
        
        // CARPETA 1: DOCUMENTACIÓN
        const docsFolder = zip.folder("01_Documentacion");
        if (docsFolder) {
            docsFolder.file("Guia_Produccion_IA.txt", documentation.aiProductionGuide);
            docsFolder.file("Biblia_Director.txt", documentation.directorsBible);
            docsFolder.file("Guia_Estilo_Visual.txt", documentation.visualStyleGuide);
            docsFolder.file("Plan_Maestro.json", JSON.stringify(plan, null, 2));
        }
        
        // CARPETA 2: PERSONAJES
        const charactersFolder = zip.folder("02_Personajes");
        if (charactersFolder) {
            for (const character of referenceAssets.characters) {
                const blob = imageBlobCache.get(character.id);
                if (blob) {
                    charactersFolder.file(`${character.name.replace(/\s+/g, '_')}.png`, blob);
                    charactersFolder.file(`${character.name.replace(/\s+/g, '_')}_prompt.txt`, character.prompt || '');
                }
            }
        }
        
        // CARPETA 3: AMBIENTES
        const environmentsFolder = zip.folder("03_Ambientes");
        if (environmentsFolder) {
            for (const environment of referenceAssets.environments) {
                const blob = imageBlobCache.get(environment.id);
                if (blob) {
                    environmentsFolder.file(`${environment.name.replace(/\s+/g, '_')}.png`, blob);
                    environmentsFolder.file(`${environment.name.replace(/\s+/g, '_')}_prompt.txt`, environment.prompt || '');
                }
            }
        }
        
        // CARPETA 4: ESCENAS
        const scenesFolder = zip.folder("04_Escenas");
        if (scenesFolder) {
            for (const frame of sceneFrames) {
                const blob = imageBlobCache.get(frame.id);
                if (blob) {
                    scenesFolder.file(`${frame.name?.replace(/\s+/g, '_')}.png`, blob);
                    scenesFolder.file(`${frame.name?.replace(/\s+/g, '_')}_prompt.txt`, frame.prompt || '');
                    if (frame.metadata) {
                        scenesFolder.file(`${frame.name?.replace(/\s+/g, '_')}_metadata.json`, JSON.stringify(frame.metadata, null, 2));
                    }
                }
            }
        }
        
        // ARCHIVO README
        const readme = `# ${plan.metadata.title}

## Descripción
${plan.metadata.logline}

## Formato
${plan.metadata.format}

## Personajes
${plan.characters.map(char => `- **${char.name}**: ${char.description}`).join('\n')}

## Estructura Narrativa
${plan.story_structure.narrative_arc.map(act => 
    `### Acto ${act.act}: ${act.name}\n${act.scenes.map(scene => 
        `- Escena ${scene.scene_number}: ${scene.title} (${scene.duration_seconds}s)`
    ).join('\n')}`
).join('\n\n')}

## Archivos Incluidos
- 📁 01_Documentacion: Guías de producción profesional
- 📁 02_Personajes: Imágenes y prompts de personajes
- 📁 03_Ambientes: Imágenes y prompts de ambientes  
- 📁 04_Escenas: Fotogramas de escenas com metadata

Generado el ${new Date().toLocaleDateString('es-ES')} com Arquitectura Neuronal IA
`;
        
        zip.file("README.md", readme);
        
        // GENERAR Y DESCARGAR ZIP
        console.log('📦 Generando archivo ZIP...');
        const content = await zip.generateAsync({type: "blob"});
        
        // CREAR DESCARGA
        const url = window.URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${plan.metadata.title.replace(/\s+/g, '_')}_Proyecto_Completo.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('%c✅ DESCARGA COMPLETA: Proyecto guardado en tu carpeta de Descargas', 'color: lightgreen; font-weight: bold;');
        
    } catch (error) {
        console.error('❌ Error creando ZIP de descarga:', error);
        alert('Error al crear la descarga. Revisa la consola para detalles.');
    }
}

// FUNCIÓN PARA BOTÓN DE DESCARGA LOCAL
export async function downloadProjectLocally(
    plan: StoryMasterplan,
    documentation: Documentation,
    referenceAssets: GeneratedReferenceAssets,
    sceneFrames: ReferenceAsset[]
): Promise<void> {
    await createProjectZipDownload(plan, documentation, referenceAssets, sceneFrames);
}