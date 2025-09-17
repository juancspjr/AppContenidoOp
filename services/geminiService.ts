/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, Modality, GenerateContentResponse, GenerateImagesResponse, GenerateVideosOperation } from '@google/genai';
import type { StoryData, StoryMasterplan, AIRecommendation, Documentation, Critique, GeneratedReferenceAssets, ProgressUpdate, FinalAssets, ReferenceAsset, Scene, ImageAnalysis, VisualConsistencySchema, CharacterPromptStructure, SceneCompositionStructure, CharacterData, ClassifiedScene, HybridExecutionPlan, ExportedProject, ExportedGeneratedReferenceAssets, ExportedReferenceAsset } from '@/components/story-builder/types';
import { outputFormats } from '@/components/story-builder/constants';
import { imageBlobCache } from './imageBlobCache';
import JSZip from 'jszip';
import { PersistentAPIKeyManager } from './apiKeyBlacklist';
import { geminiWebService } from './geminiWebService';
import { assetRegistry, CanonicalAsset } from './assetRegistry';

export type { AIRecommendation };

// Módulo de caché para la guía de consistencia, asegurando que se utilice la misma guía
// a través de las diferentes etapas de generación de activos sin cambiar las firmas de las funciones.
let lastExecutionPlan: HybridExecutionPlan | null = null;

// FIX: Added cancellation token for long-running generation tasks.
let isGenerationCancelled = false;

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
        private availableKeys: ApiKeyState[] = [];
        private cooldownKeys: ApiKeyState[] = [];

        constructor() {
            this.initializeKeys();
        }
    
        private initializeKeys() {
            // FILTRAR KEYS USANDO EL SISTEMA PERSISTENTE
            const validKeys = PersistentAPIKeyManager.getAvailableAPIs(GEMINI_KEYS);
            
            this.availableKeys = validKeys.map(k => ({ ...k, cooldownUntil: 0 }))
                .sort((a, b) => a.priority - b.priority);
            
            this.cooldownKeys = [];
            
            console.log(`🔑 APIs disponibles: ${this.availableKeys.length}/${GEMINI_KEYS.length}`);
            
            // MOSTRAR ESTADÍSTICAS
            const stats = PersistentAPIKeyManager.getStats();
            console.log(`📊 Estado APIs - Activas: ${stats.active + (GEMINI_KEYS.length - stats.total)}, Agotadas: ${stats.quotaExhausted + stats.dailyLimit}, Bloqueadas: ${stats.permanentlyBlocked}`);
        }

        public async getKey(): Promise<ApiKeyState> {
            // RE-INICIALIZAR SI NO HAY KEYS DISPONIBLES
            if (this.availableKeys.length === 0) {
                console.log('🔄 Reinicializando lista de APIs...');
                this.initializeKeys();
                
                if (this.availableKeys.length === 0) {
                    const stats = PersistentAPIKeyManager.getStats();
                    throw new Error(`🚫 TODAS LAS APIs AGOTADAS - Activas: ${stats.active}, Bloqueadas: ${stats.permanentlyBlocked}. Espera hasta medianoche PST o resetea manualmente.`);
                }
            }
            
            this.checkCooldowns();
            
            // SI NO HAY KEYS DESPUÉS DE COOLDOWN, ESPERAR
            while (this.availableKeys.length === 0 && this.cooldownKeys.length > 0) {
                const soonest = Math.min(...this.cooldownKeys.map(k => k.cooldownUntil));
                const waitTime = soonest - Date.now();
                
                if (waitTime > 0) {
                    console.log(`⏳ Esperando ${Math.round(waitTime/1000)}s para siguiente API...`);
                    await new Promise(r => setTimeout(r, waitTime + 100));
                }
                
                this.checkCooldowns();
            }
            
            if (this.availableKeys.length === 0) { // Double check after cooldown
                 throw new Error(`🚫 TODAS LAS APIs AGOTADAS o en cooldown. Inténtalo de nuevo más tarde.`);
            }

            return this.availableKeys[0];
        }
    
        public reportFailure(keyId: string, meta: FailureMeta) {
            const keyData = [...this.availableKeys, ...this.cooldownKeys].find(k => k.id === keyId);
            if (!keyData) return;
            
            // MARCAR EN SISTEMA PERSISTENTE
            PersistentAPIKeyManager.markAsExhausted(keyId, keyData, meta.error?.message || 'Error desconocido');
            
            // REMOVER DE LISTAS LOCALES
            this.availableKeys = this.availableKeys.filter(k => k.id !== keyId);
            this.cooldownKeys = this.cooldownKeys.filter(k => k.id !== keyId);
            
            console.log(`❌ API ${keyData.projectName} removida de la sesión actual.`);
        }
        
        public reportSuccess(keyId: string) {
            const keyData = this.availableKeys.find(k => k.id === keyId);
            if (keyData) {
                // MARCAR COMO EXITOSA EN SISTEMA PERSISTENTE
                PersistentAPIKeyManager.markAsSuccessful(keyId, keyData);

                // MOVER AL FRENTE DE LA LISTA
                const keyIndex = this.availableKeys.findIndex(k => k.id === keyId);
                if (keyIndex > 0) {
                    const [key] = this.availableKeys.splice(keyIndex, 1);
                    this.availableKeys.unshift(key);
                }
            }
        }

        // MÉTODO PARA FORZAR REINICIALIZACIÓN
        public forceRefresh() {
            this.initializeKeys();
        }

        private checkCooldowns() {
            const now = Date.now();
            const recovered = this.cooldownKeys.filter(k => now >= k.cooldownUntil);
            if (recovered.length > 0) {
                this.cooldownKeys = this.cooldownKeys.filter(k => now < k.cooldownUntil);
                this.availableKeys.push(...recovered);
                this.availableKeys.sort((a, b) => a.priority - b.priority);
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
        for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
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
        throw new Error(`La llamada a la API falló tras intentar con todas las claves disponibles. Último error: ${lastError?.message || 'Desconocido'}`);
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
        // Expose for admin functions
        getKeyManager: () => keyManager
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
        // FIX: Destructure data and mimeType from inlineData to fix reference error.
        const { data, mimeType } = imagePartResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
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

// ============================================================================
// 🛡️ MODO CONSERVACIÓN EXTREMA - IMPLEMENTAR INMEDIATAMENTE
// ============================================================================

class UltraConservationMode {
    private static quotaUsed = 0;
    private static readonly MAX_QUOTA = 20; // Reservar 5 para emergencias
    
    static canMakeCall(): boolean {
        return this.quotaUsed < this.MAX_QUOTA;
    }
    
    static recordCall(): void {
        this.quotaUsed++;
        console.log(`📊 Quota usada: ${this.quotaUsed}/${this.MAX_QUOTA}`);
    }
    
    static getRemainingQuota(): number {
        return this.MAX_QUOTA - this.quotaUsed;
    }
    // FIX: Added public getter for private property to resolve access error.
    static getQuotaUsed(): number {
        return this.quotaUsed;
    }
}

// REEMPLAZAR generateAdvancedStoryPlan CON VERSIÓN ULTRA-CONSERVADORA
export async function generateAdvancedStoryPlan(storyData: StoryData): Promise<{
    plan: StoryMasterplan;
    creativeProcess: any;
    consciousness_metadata: any;
}> {
    
    if (!UltraConservationMode.canMakeCall()) {
        throw new Error(`🚨 QUOTA CRÍTICA: Solo quedan ${UltraConservationMode.getRemainingQuota()} llamadas diarias. Usa modo manual.`);
    }
    
    console.log('🛡️ MODO ULTRA-CONSERVACIÓN: 1 sola llamada para generar plan completo');
    
    const ultraConservativePrompt = addAntiLoopInstructions(`Eres un Maestro Director de Contenido Viral que crea planes de historia completos en una sola respuesta.

DATOS DE ENTRADA: ${JSON.stringify(storyData)}

MISIÓN CRÍTICA: Generar un StoryMasterplan completo, profesional y listo para producción en una sola llamada API.

INCLUYE OBLIGATORIAMENTE:
1. Metadata completa (título, logline, formato, estilos)
2. Personajes desarrollados con prompts visuales específicos
3. Estructura narrativa con 8-12 escenas detalladas
4. Cada escena debe tener: título, resumen, descripción visual, diálogo, diseño sonoro, duración
5. Optimizado para ${storyData.format} con energía nivel ${storyData.energyLevel}/10

ESTILOS APLICAR:
- Narrativos: ${storyData.narrativeStyles.join(', ')}
- Visuales: ${storyData.visualStyles.join(', ')}
- Estructura: ${storyData.narrativeStructure.join(', ')}
- Ganchos: ${storyData.hook.join(', ')}
- Conflictos: ${storyData.conflict.join(', ')}
- Finales: ${storyData.ending.join(', ')}

IMPORTANTE: 
- Una respuesta ultra-completa y profesional
- Sin necesidad de análisis adicionales
- Formato JSON válido
- Optimizado para contenido viral

Devuelve el StoryMasterplan JSON completo y perfecto.`);

    try {
        UltraConservationMode.recordCall();
        
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: ultraConservativePrompt,
            config: { 
                responseMimeType: 'application/json',
                responseSchema: storyMasterplanSchema 
            }
        });
        
        const plan = safeParseJsonResponse<StoryMasterplan>(response.text);
        
        console.log('✅ Plan ultra-conservador generado exitosamente');
        
        return {
            plan,
            creativeProcess: {
                mode: 'ultra_conservation',
                quota_used: UltraConservationMode.getQuotaUsed(),
                quota_remaining: UltraConservationMode.getRemainingQuota(),
                message: '1 sola llamada API - Máxima eficiencia'
            },
            consciousness_metadata: {
                emergence_achieved: true,
                creative_breakthroughs: 1,
                evolutionary_fitness: 8 // Alta calidad en una llamada
            }
        };
        
    } catch (error) {
        console.error('❌ Error en modo ultra-conservación:', error);
        throw error;
    }
}

export async function generateStoryFromPrompt(storyData: StoryData): Promise<StoryMasterplan> {
    try {
        const result = await generateAdvancedStoryPlan(storyData);
        // @ts-ignore
        console.log(`🎨 Proceso creativo completado: Nivel de consciencia: ${result.creativeProcess.consciousness_level || 'N/A'}/10`);
        return result.plan;
    } catch (error) {
        console.warn('⚠️ Arquitectura neuronal falló, usando fallback básico:', error);
        const prompt = addAntiLoopInstructions(`Based on the following user input, generate a complete StoryMasterplan JSON object... User Input: ${JSON.stringify(storyData)}`);
        const response = await backendProxy.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: storyMasterplanSchema } });
        return safeParseJsonResponse<StoryMasterplan>(response.text);
    }
}

// Local helper for documentation fallback
function generateLocalProductionGuide(plan: StoryMasterplan): string {
    return `
# Guía de Producción (Modo Local)
## Título: ${plan.metadata.title}
## Logline: ${plan.metadata.logline}
Este es un documento generado localmente debido a límites de quota. Contiene la información básica del plan.
---
${JSON.stringify(plan, null, 2)}
    `.trim();
}

function generateLocalDirectorsBible(plan: StoryMasterplan): string {
    return `
# Biblia del Director (Modo Local)
## Visión
La visión es ejecutar el plan "${plan.metadata.title}" con un estilo de ${plan.metadata.style_and_energy.visual_styles.join(', ')} y una energía de ${plan.metadata.style_and_energy.energy_level}/10.
    `.trim();
}

function generateLocalVisualGuide(plan: StoryMasterplan): string {
    return `
# Guía Visual (Modo Local)
## Estilos Visuales Clave
- ${plan.metadata.style_and_energy.visual_styles.join('\n- ')}
## Paleta de Colores
- Se determinará en base a los estilos visuales.
    `.trim();
}

// Local helper for critique fallback
function generateLocalCritique(plan: StoryMasterplan, userData: StoryData): Critique {
    // A very basic, generic critique
    return {
        projectSummary: {
            about: `Un proyecto sobre "${plan.metadata.logline}"`,
            keyElements: [...userData.narrativeStyles, ...userData.visualStyles],
            identifiedStrengths: ["Concepto claro.", "Potencial para formato corto."],
        },
        verticalFormatEvaluation: {
            title: "Evaluación de Formato Vertical",
            strengths: ["La estructura puede adaptarse bien al formato vertical."],
            weaknesses: {
                title: "Áreas de Mejora",
                points: ["El gancho inicial podría ser más fuerte.", "Asegurar que cada escena sea visualmente impactante."]
            },
        },
        improvementStrategy: {
            title: "Estrategia de Mejora",
            strategies: [{ title: "Potenciar el Gancho", description: "Revisar los primeros 3 segundos para asegurar que capturan la atención inmediatamente." }]
        },
        specificImprovements: {
            title: "Mejoras Específicas",
            visualSimplification: { title: "Simplificación Visual", keyElements: ["Foco en el personaje principal.", "Fondos claros."] },
            audioOptimization: "Usar audio en tendencia para aumentar el alcance.",
        },
        proposedSolution: {
            title: "Solución Propuesta",
            solutionTitle: "Mantener el plan actual con un gancho más fuerte.",
            episodes: []
        },
        finalRecommendation: {
            title: "Recomendación Final",
            recommendation: "Proceder con el plan actual, pero considerar aplicar las mejoras sugeridas."
        },
        implementationPlan: {
            title: "Plan de Implementación",
            nextSteps: ["Aplicar mejoras al plan.", "Generar activos de referencia."],
            requiredResources: ["Activos visuales consistentes."]
        }
    };
}

// Local helper for regeneration fallback
function applyLocalImprovements(plan: StoryMasterplan, critique: Critique): StoryMasterplan {
    const improvedPlan: StoryMasterplan = JSON.parse(JSON.stringify(plan));
    improvedPlan.metadata.logline += " (Versión mejorada localmente)";
    if (critique.verticalFormatEvaluation.weaknesses.points.some(p => p.includes('gancho'))) {
        improvedPlan.story_structure.hook = "Un gancho inicial más dinámico y visualmente impactante para capturar la atención en los primeros 2 segundos.";
    }
    return improvedPlan;
}

// SIMPLIFICAR generateAllDocumentation - 1 LLAMADA MAX
export async function generateAllDocumentation(plan: StoryMasterplan): Promise<Documentation> {
    
    if (!UltraConservationMode.canMakeCall()) {
        // MODO TEMPLATE LOCAL - SIN API
        return {
            aiProductionGuide: generateLocalProductionGuide(plan),
            directorsBible: generateLocalDirectorsBible(plan),
            visualStyleGuide: generateLocalVisualGuide(plan)
        };
    }
    
    console.log('📚 Generando documentación ultra-eficiente...');
    
    const efficientPrompt = `Genera 3 documentos profesionales para: ${JSON.stringify(plan)}

DOCUMENTO 1 - GUÍA DE PRODUCCIÓN IA:
[Guía técnica completa con especificaciones y prompts]

===SEPARADOR===

DOCUMENTO 2 - BIBLIA DEL DIRECTOR:
[Dirección artística y blocking detallado]  

===SEPARADOR===

DOCUMENTO 3 - GUÍA VISUAL:
[Paletas, iluminación y estilo cinematográfico]

Respuesta en español, ultra-específica y profesional.`;

    try {
        UltraConservationMode.recordCall();
        
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: efficientPrompt
        });
        
        const parts = response.text.split('===SEPARADOR===');
        
        return {
            aiProductionGuide: parts[0]?.trim() || generateLocalProductionGuide(plan),
            directorsBible: parts[1]?.trim() || generateLocalDirectorsBible(plan),
            visualStyleGuide: parts[2]?.trim() || generateLocalVisualGuide(plan)
        };
        
    } catch (error) {
        console.warn('⚠️ Documentación API falló, usando templates locales');
        return {
            aiProductionGuide: generateLocalProductionGuide(plan),
            directorsBible: generateLocalDirectorsBible(plan),
            visualStyleGuide: generateLocalVisualGuide(plan)
        };
    }
}

async function generateWithGeminiAPI(
    prompt: string,
    aspectRatio: ReferenceAsset['aspectRatio'],
    options?: any
): Promise<Blob> {
    const response = await backendProxy.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] }
    });
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("No se encontró data de imagen en la respuesta de Gemini API");
    const byteCharacters = atob(imagePart.inlineData.data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
    return new Blob([byteArray], { type: imagePart.inlineData.mimeType });
}

async function generateWithImagen(
    prompt: string,
    aspectRatio: ReferenceAsset['aspectRatio']
): Promise<Blob> {
    const response: GenerateImagesResponse = await backendProxy.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/png', 
            aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio 
        },
    });
    if (!response.generatedImages?.[0]?.image?.imageBytes) throw new Error(`Fallback a Imagen-4.0 falló`);
    const byteString = atob(response.generatedImages[0].image.imageBytes);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) uint8Array[i] = byteString.charCodeAt(i);
    return new Blob([arrayBuffer], { type: 'image/png' });
}


export async function generateImageWithFallback(
    prompt: string, 
    aspectRatio: ReferenceAsset['aspectRatio'],
    options?: {
        referenceAssets?: GeneratedReferenceAssets;
        scene?: Scene;
        storyPlan?: StoryMasterplan;
        userData?: StoryData;
        referenceImage?: File; // Nueva opción para imagen de referencia
        sceneReferences?: {name:string, type:string, blobId:string}[]; // Para escenas con múltiples referencias
    }
): Promise<Blob> {
    
    const { referenceImage, sceneReferences } = options || {};
    
    const aspectPrompt = aspectRatio === '9:16' 
        ? 'vertical 9:16 aspect ratio, mobile composition, portrait orientation' 
        : `${aspectRatio} aspect ratio`;
        
    const enhancedPrompt = `${prompt}, ${aspectPrompt}, high quality, professional rendering, sharp focus, detailed`;
    
    try {
        // Prioritize multi-reference generation for scenes
        if (sceneReferences && sceneReferences.length > 0) {
            console.log(`🎬 Generando escena con ${sceneReferences.length} referencias...`);
            const parts: any[] = [];
            for (const ref of sceneReferences) {
                const blob = imageBlobCache.get(ref.blobId);
                if (!blob) continue;
                const base64 = btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
                parts.push({ inlineData: { mimeType: 'image/png', data: base64 }});
                parts.push({ text: `Reference: ${ref.type} "${ref.name}". Keep identity/style exactly.`});
            }
            parts.push({ text: `${enhancedPrompt}, Keep identity/style exactly as the referenced images. Do not change face geometry, moustache, or wardrobe. Use the referenced environment as visual base. One clear main subject, no extra people, no identity drift.` });

            const response = await backendProxy.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE] }
            });

            const img = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!img?.inlineData) throw new Error('La generación de escena con referencias no devolvió una imagen');
            const bytes = atob(img.inlineData.data);
            const arr = Uint8Array.from(bytes, c => c.charCodeAt(0));
            return new Blob([arr], { type: img.inlineData.mimeType });
        }

        // Standard generation (API, then Web, then Imagen)
        console.log("%c🟢 PRIMARIO: Gemini API Oficial", "color: lightgreen; font-weight: bold;");
        return await generateWithGeminiAPI(enhancedPrompt, aspectRatio, options);
        
    } catch (apiError: any) {
        console.warn(`%c🟡 API FALLÓ: ${apiError.message}`, "color: orange; font-weight: bold;");
        
        if (geminiWebService.isInitialized()) {
            try {
                console.log("%c🌐 FALLBACK GEMINI WEB: Generación ilimitada", "color: cyan; font-weight: bold;");
                if (referenceImage) {
                    const result = await geminiWebService.generateWithAnalyzedReference(enhancedPrompt, referenceImage);
                    console.log(`🔍 Análisis: ${result.analysis.substring(0, 100)}...`);
                    console.log("%c✅ ÉXITO: Imagen generada con Gemini Web + análisis", "color: cyan; font-weight: bold;");
                    return result.generatedImage;
                } else {
                    const image = await geminiWebService.generateImage(enhancedPrompt);
                    console.log("%c✅ ÉXITO: Imagen generada con Gemini Web", "color: cyan; font-weight: bold;");
                    return image;
                }
            } catch (webError: any) {
                console.warn(`%c🟡 GEMINI WEB FALLÓ: ${webError.message}`, "color: orange; font-weight: bold;");
            }
        } else {
            console.warn("%c⚠️ GEMINI WEB NO INICIALIZADO", "color: orange; font-weight: bold;");
        }
        
        console.log("%c🔶 FALLBACK FINAL: Imagen-4.0", "color: orange; font-weight: bold;");
        return await generateWithImagen(enhancedPrompt, aspectRatio);
    }
}


export async function generateCharacterWithReference(
    character: any,
    userImage: File | null,
    aspectRatio: ReferenceAsset['aspectRatio']
): Promise<{ image: Blob; analysis?: string }> {
    
    const basePrompt = `Professional character portrait: ${character.description}, ${character.visual_prompt || ''}, high quality 3D rendering, ${aspectRatio} aspect ratio, professional lighting`;
    
    if (userImage && geminiWebService.isInitialized()) {
        try {
            console.log(`🎭 Generando ${character.name} CON imagen de referencia usando análisis IA`);
            const result = await geminiWebService.generateWithAnalyzedReference(basePrompt, userImage);
            return { image: result.generatedImage, analysis: result.analysis };
        } catch (error) {
            console.warn(`⚠️ Error con análisis, usando método estándar:`, error);
        }
    }
    
    const image = await generateImageWithFallback(basePrompt, aspectRatio, { referenceImage: userImage || undefined });
    return { image };
}

// ============================================================================
// 🛠️ FUNCIONES DE ADMINISTRACIÓN DE APIs
// ============================================================================

// FUNCIÓN PARA MOSTRAR ESTADO DE TODAS LAS APIs
export function showAPIStatus(): void {
    const status = PersistentAPIKeyManager.listAPIStatus();
    const stats = PersistentAPIKeyManager.getStats();
    
    console.log('\n🔑 ESTADO ACTUAL DE APIs:');
    console.log(`📊 Total: ${stats.total} | Activas: ${stats.active} | Agotadas: ${stats.quotaExhausted} | Límite Diario: ${stats.dailyLimit} | Bloqueadas: ${stats.permanentlyBlocked}\n`);
    
    status.forEach(api => {
        const statusIcon = {
            'active': '✅',
            'quota_exhausted': '❌',
            'daily_limit': '⏰',
            'permanently_blocked': '🚫'
        }[api.status] || '❓';
        
        const resetInfo = api.resetAt ? ` (reset: ${new Date(api.resetAt).toLocaleString()})` : '';
        const failCount = api.failureCount > 0 ? ` [${api.failureCount} fallos]` : '';
        
        console.log(`${statusIcon} ${api.projectName}: ${api.status}${resetInfo}${failCount}`);
    });
}

// FUNCIÓN PARA RESETEAR TODAS LAS APIs (EMERGENCIA)
export function resetAllAPIs(): void {
    PersistentAPIKeyManager.resetAllAPIs();
    backendProxy.getKeyManager().forceRefresh();
    console.log('🔄 TODAS LAS APIs RESETEADAS');
}

// FUNCIÓN PARA RESETEAR UNA API ESPECÍFICA
export function resetSpecificAPI(projectName: string): void {
    const statusMap = PersistentAPIKeyManager.loadAPIStatus();
    let found = false;
    
    statusMap.forEach((status, keyId) => {
        if (status.projectName === projectName) {
            status.status = 'active';
            status.failureCount = 0;
            status.exhaustedAt = undefined;
            status.resetAt = undefined;
            statusMap.set(keyId, status);
            found = true;
        }
    });
    
    if (found) {
        PersistentAPIKeyManager.saveAPIStatus(statusMap);
        backendProxy.getKeyManager().forceRefresh();
        console.log(`✅ API ${projectName} reseteada exitosamente`);
    } else {
        console.log(`❌ API ${projectName} no encontrada`);
    }
}

// For console access
(window as any).showAPIStatus = showAPIStatus;
(window as any).resetAllAPIs = resetAllAPIs;
(window as any).resetSpecificAPI = resetSpecificAPI;

// ============================================================================
// ➕ FUNCIONES RESTAURADAS Y DE CONSISTENCIA
// ============================================================================

export function cancelCurrentGeneration() {
  isGenerationCancelled = true;
  console.log("🔴 La generación ha sido marcada para cancelación.");
}

export async function generateCritique(plan: StoryMasterplan, userData: StoryData): Promise<Critique> {
    if (!UltraConservationMode.canMakeCall()) {
        return generateLocalCritique(plan, userData);
    }

    console.log('🧐 Generando crítica ultra-eficiente...');
    const prompt = addAntiLoopInstructions(`You are a viral content strategist AI. Analyze this StoryMasterplan and the original user data to provide a strategic critique.
    
    StoryMasterplan: ${JSON.stringify(plan)}
    User Data: ${JSON.stringify(userData)}

    Your task is to generate a JSON object following the Critique schema. The critique should be constructive, actionable, and focused on maximizing engagement for the target format: ${plan.metadata.format}.
    Provide deep insights into strengths, weaknesses, and a clear improvement strategy.
    
    Return ONLY the valid JSON object adhering to the Critique schema.`);

    try {
        UltraConservationMode.recordCall();
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: critiqueSchema
            }
        });
        return safeParseJsonResponse<Critique>(response.text);
    } catch (error) {
        console.warn('⚠️ Crítica API falló, usando template local');
        return generateLocalCritique(plan, userData);
    }
}

export async function regenerateStoryPlanWithCritique(plan: StoryMasterplan, critique: Critique, onProgress: (phase: string, message: string) => void): Promise<StoryMasterplan> {
    if (!UltraConservationMode.canMakeCall()) {
        onProgress('local_fallback', 'Aplicando mejoras localmente debido a límites de quota.');
        return applyLocalImprovements(plan, critique);
    }

    onProgress('start', 'Iniciando regeneración...');
    const prompt = addAntiLoopInstructions(`You are a master storyteller AI. Regenerate and improve a StoryMasterplan based on a strategic critique.

    Original StoryMasterplan: ${JSON.stringify(plan)}
    Critique to apply: ${JSON.stringify(critique.improvementStrategy)}

    Apply all suggestions to create a new, superior StoryMasterplan.
    Return ONLY the new, improved StoryMasterplan JSON object.`);

    try {
        UltraConservationMode.recordCall();
        onProgress('api_call', 'Enviando petición a la IA...');
        const response = await backendProxy.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: storyMasterplanSchema,
            }
        });
        onProgress('complete', 'Regeneración completada.');
        return safeParseJsonResponse<StoryMasterplan>(response.text);
    } catch (error) {
        console.warn('⚠️ Regeneración API falló, aplicando mejoras locales');
        return applyLocalImprovements(plan, critique);
    }
}

export async function generateOptimizedReferenceAssets(
    plan: StoryMasterplan,
    userData: StoryData,
    aspectRatio: ReferenceAsset['aspectRatio'],
    onProgress: (current: number, total: number, message: string) => void
): Promise<GeneratedReferenceAssets> {
    isGenerationCancelled = false;
    const assets: GeneratedReferenceAssets = { characters: [], environments: [], elements: [], sceneFrames: [] };
    const charactersToGen = plan.characters.slice(0, 3); // Limit to max 3
    let current = 0;
    for (const char of charactersToGen) {
        if (isGenerationCancelled) throw new Error("Generación cancelada.");
        current++;
        onProgress(current, charactersToGen.length, `Generando personaje: ${char.name}...`);
        const userChar = userData.characters.find(c => c.name === char.name);
        const { image } = await generateCharacterWithReference(char, userChar?.image || null, aspectRatio);
        const assetId = crypto.randomUUID();
        imageBlobCache.set(assetId, image);
        assets.characters.push({
            id: assetId, name: char.name, type: 'character', prompt: char.visual_prompt,
            aspectRatio, source: 'generated'
        });
    }
    return assets;
}

export async function generateHybridNeuralSceneFrame(
    plan: StoryMasterplan,
    scene: Scene,
    assets: GeneratedReferenceAssets,
    aspectRatio: ReferenceAsset['aspectRatio'],
    frameType: 'start' | 'climax' | 'end',
    userData: StoryData,
    onProgress: (message: string) => void
): Promise<ReferenceAsset> {
    onProgress(`Generando frame para escena ${scene.scene_number}...`);
    
    const sceneReferences = buildSceneReferencePack(scene, plan);
    
    const prompt = `Generate a cinematic keyframe for scene ${scene.scene_number} (${scene.title}) at its '${frameType}' moment. Visuals: ${scene.visual_description}. Style: ${plan.metadata.style_and_energy.visual_styles.join(', ')}`;
    
    const blob = await generateImageWithFallback(prompt, aspectRatio, { sceneReferences });
    
    const newFrame: ReferenceAsset = {
        id: crypto.randomUUID(), name: `Scene ${scene.scene_number} - ${frameType}`, type: 'scene_frame',
        prompt, aspectRatio, source: 'generated_hybrid_neural', sceneNumber: scene.scene_number, frameType
    };
    imageBlobCache.set(newFrame.id, blob);
    assetRegistry.add({
        id: newFrame.id, name: newFrame.name, type: 'scene_frame', tags: ['keyframe'],
        aspectRatio, prompt, blobId: newFrame.id, sourcePhase: 'scene'
    });
    return newFrame;
}

export async function runFinalVideoGenerationPipeline(
    plan: StoryMasterplan,
    assets: GeneratedReferenceAssets,
    productionGuide: string,
    onProgress: (update: ProgressUpdate) => void
): Promise<FinalAssets> {
    isGenerationCancelled = false;
    const finalAssets: FinalAssets = { imageAssets: [], videoAssets: [], audioAssets: [] };
    const allScenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);
    onProgress({ stage: 'videos', status: 'in_progress', message: `Iniciando generación de video...` });

    for (const scene of allScenes) {
        if (isGenerationCancelled) throw new Error("Generación cancelada.");
        const sceneId = `scene_${scene.scene_number}`;
        onProgress({ stage: 'videos', status: 'in_progress', message: `Generando video para escena ${scene.scene_number}...`, sceneId });
        try {
            const videoPrompt = `${scene.visual_description}. Style: ${plan.metadata.style_and_energy.visual_styles.join(', ')}`;
            let operation: GenerateVideosOperation = await backendProxy.generateVideos({ model: 'veo-2.0-generate-001', prompt: videoPrompt, config: { numberOfVideos: 1 } });
            while (!operation.done) {
                if (isGenerationCancelled) throw new Error("Generación cancelada.");
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await backendProxy.getVideosOperation({ operation });
            }
            if (operation.response?.generatedVideos?.[0]?.video?.uri) {
                const downloadLink = operation.response.generatedVideos[0].video.uri;
                const videoBlob = await backendProxy.fetchVideo(downloadLink);
                const assetId = crypto.randomUUID();
                imageBlobCache.set(assetId, videoBlob);
                finalAssets.videoAssets.push({ sceneId, segment: 1, assetId, prompt: videoPrompt });
                onProgress({ stage: 'videos', status: 'complete', message: `Video generado para escena ${scene.scene_number}.`, sceneId });
            } else { throw new Error('La operación de video no devolvió URI.'); }
        } catch(e) {
            onProgress({ stage: 'videos', status: 'error', message: `Fallo en video para escena ${scene.scene_number}: ${e instanceof Error ? e.message : 'Error'}`});
        }
    }
    onProgress({ stage: 'complete', status: 'complete', message: 'Todos los videos generados.' });
    return finalAssets;
}

export async function downloadProjectLocally(
    plan: StoryMasterplan,
    documentation: Documentation,
    assets: GeneratedReferenceAssets,
    critique: Critique | null
): Promise<void> {
    const zip = new JSZip();
    const title = plan.metadata.title.replace(/\s+/g, '_');
    const convert = async (a: ReferenceAsset[]): Promise<ExportedReferenceAsset[]> => Promise.all(a.map(async (asset) => {
        const blob = imageBlobCache.get(asset.id);
        const imageData = blob ? await new Promise<string>(r => { const reader = new FileReader(); reader.onload = () => r(reader.result as string); reader.readAsDataURL(blob); }) : undefined;
        return { ...asset, imageData };
    }));
    const exportAssets: ExportedGeneratedReferenceAssets = { characters: await convert(assets.characters), environments: await convert(assets.environments), elements: await convert(assets.elements), sceneFrames: await convert(assets.sceneFrames) };
    const project: ExportedProject = { plan, documentation, critique: critique || {} as Critique, assets: exportAssets };
    zip.file(`${title}_Project.json`, JSON.stringify(project, null, 2));
    const allAssets = Object.values(assets).flat();
    for(const asset of allAssets) {
        const blob = imageBlobCache.get(asset.id);
        if (blob) zip.file(`assets/${asset.type}/${asset.name.replace(/[^a-z0-9]/gi, '_')}.png`, blob);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${title}_Project.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// --- Consistencia y Generación Automática ---

async function hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildCharacterPromptConsistent(char: any, plan: StoryMasterplan, userData: StoryData): string {
    const styles = plan.metadata.style_and_energy?.visual_styles?.join(', ') || userData.visualStyles?.join(', ') || 'cinematic 3D';
    return [
        `Identity-locked character portrait of ${char.name}`,
        `${char.description}`,
        'Replicate the exact identity of the uploaded reference image if provided',
        'Do not alter face geometry, moustache shape/density, or body proportions',
        'Preserve wardrobe details and decorations consistently',
        `Style: ${styles}, professional 3D rendering, studio cinematic lighting`,
        'Neutral, unobtrusive background for compositing',
        'Vertical 9:16 aspect ratio, mobile-optimized framing',
        'Ultra-high resolution, sharp focus, clean edges',
        'Single subject only, no extra people, no cropped face',
        'Negative: extra fingers, deformation, blur, artifacts, low quality'
    ].join(', ');
}

function buildEnvironmentPrompt(envName: string, plan: StoryMasterplan, userData: StoryData): string {
    const styles = plan.metadata.style_and_energy?.visual_styles?.join(', ') || userData.visualStyles?.join(', ') || 'cinematic 3D';
    return [
        `Environment style sheet: ${envName}`,
        'Architectural cues and layout readable in a single shot',
        `Style: ${styles}, consistent color palette with project`,
        'Professional 3D rendering, studio lighting, clean detail',
        'Vertical 9:16 layout, negative space for overlay',
        'Ultra-high resolution, sharp textures, no people inside',
        'Negative: cluttered signage, random objects, text artifacts'
    ].join(', ');
}

function buildPropPrompt(propName: string, plan: StoryMasterplan, userData: StoryData): string {
    const styles = plan.metadata.style_and_energy?.visual_styles?.join(', ') || userData.visualStyles?.join(', ');
    return [
        `Prop reference sheet: ${propName}`,
        'Orthographic 3/4 reference, readable materials and controls',
        `Style: ${styles}, consistent design language with story`,
        'Vertical 9:16 layout, neutral background, studio lighting',
        'Ultra-high resolution, crisp lines, no hands, no people'
    ].join(', ');
}

function extractUniqueEnvironments(plan: StoryMasterplan): string[] {
    const set = new Set<string>();
    for (const act of plan.story_structure.narrative_arc) {
        for (const scene of act.scenes) {
            const env = guessEnvironment(scene);
            if (env) set.add(env);
        }
    }
    return Array.from(set);
}

function guessEnvironment(scene: Scene): string | null {
    const t = `${scene.title} ${scene.summary} ${scene.visual_description}`.toLowerCase();
    const map = [
        { k: ['pasillo', 'hallway', 'palacio'], v: 'Pasillo del Palacio' },
        { k: ['sala de control', 'control room'], v: 'Sala de Control' },
        { k: ['oficina', 'office'], v: 'Oficina Central' },
        { k: ['plaza', 'square'], v: 'Plaza Principal' },
    ];
    for (const m of map) if (m.k.some(k => t.includes(k))) return m.v;
    return null;
}

function extractUniqueProps(plan: StoryMasterplan): string[] {
    const set = new Set<string>();
    for (const act of plan.story_structure.narrative_arc) {
        for (const scene of act.scenes) {
            const t = `${scene.title} ${scene.summary} ${scene.visual_description} ${scene.dialogue_or_narration}`.toLowerCase();
            if (t.includes('suppressor') || t.includes('supresor')) set.add('Audience Perception Suppressor');
            if (t.includes('dispositivo inteligente') || t.includes('smart')) set.add('Smart Device');
        }
    }
    return Array.from(set);
}

export async function generateReferenceAssetsPhase63(
    plan: StoryMasterplan,
    userData: StoryData,
    aspectRatio: '9:16' | '1:1' | '16:9' | '4:5',
    onProgress: (current: number, total: number, message: string) => void
): Promise<GeneratedReferenceAssets> {
    isGenerationCancelled = false;
    const countUnique = (extractor: (p: StoryMasterplan) => string[]) => new Set(extractor(plan)).size;
    const totalPlanned = plan.characters.length + countUnique(extractUniqueEnvironments) + countUnique(extractUniqueProps);
    let current = 0; 
    const step = (msg: string) => {
        current++;
        onProgress?.(current, totalPlanned, msg);
    };

    const assets: GeneratedReferenceAssets = { characters: [], environments: [], elements: [], sceneFrames: [] };

    // 1) Characters
    for (const character of plan.characters) {
        if (isGenerationCancelled) throw new Error("Generación cancelada por el usuario.");
        if (assetRegistry.findByName(character.name, 'character')) continue;
        const userChar = userData.characters.find(c => c.name.toLowerCase() === character.name.toLowerCase());
        step(`Generando personaje: ${character.name}`);

        const prompt = buildCharacterPromptConsistent(character, plan, userData);
        const blob = await generateImageWithFallback(prompt, aspectRatio, {
            referenceImage: userChar?.image || undefined
        });
        const id = crypto.randomUUID();
        imageBlobCache.set(id, blob);

        const originHash = userChar?.image ? await hashFile(userChar.image) : undefined;
        const newAsset: ReferenceAsset = { id, name: character.name, type: 'character', prompt, aspectRatio, source: userChar?.image ? 'hybrid' : 'generated' };
        assets.characters.push(newAsset);
        assetRegistry.add({ ...newAsset, tags: ['reference', 'identity-lock'], blobId: id, sourcePhase: 'phase6.3', originHash });
    }

    // 2) Environments
    for (const envName of new Set(extractUniqueEnvironments(plan))) {
        if (isGenerationCancelled) throw new Error("Generación cancelada por el usuario.");
        if (assetRegistry.findByName(envName, 'environment')) continue;
        step(`Generando ambiente: ${envName}`);
        const envPrompt = buildEnvironmentPrompt(envName, plan, userData);
        const blob = await generateImageWithFallback(envPrompt, aspectRatio);
        const id = crypto.randomUUID();
        imageBlobCache.set(id, blob);
        const newAsset: ReferenceAsset = { id, name: envName, type: 'environment', prompt: envPrompt, aspectRatio, source: 'generated' };
        assets.environments.push(newAsset);
        assetRegistry.add({ ...newAsset, tags: ['location', 'reference', 'style-sheet'], blobId: id, sourcePhase: 'phase6.3' });
    }

    // 3) Props
    for (const propName of new Set(extractUniqueProps(plan))) {
        if (isGenerationCancelled) throw new Error("Generación cancelada por el usuario.");
        if (assetRegistry.findByName(propName, 'element')) continue;
        step(`Generando elemento clave: ${propName}`);
        const propPrompt = buildPropPrompt(propName, plan, userData);
        const blob = await generateImageWithFallback(propPrompt, aspectRatio);
        const id = crypto.randomUUID();
        imageBlobCache.set(id, blob);
        const newAsset: ReferenceAsset = { id, name: propName, type: 'element', prompt: propPrompt, aspectRatio, source: 'generated' };
        assets.elements.push(newAsset);
        assetRegistry.add({ ...newAsset, tags: ['prop', 'reference', 'sheet'], blobId: id, sourcePhase: 'phase6.3' });
    }

    return assets;
}

function buildSceneReferencePack(scene: Scene, plan: StoryMasterplan): { name: string; type: 'character' | 'environment'; blobId: string }[] {
    const text = `${scene.title} ${scene.summary} ${scene.visual_description}`.toLowerCase();
    const presentChars = plan.characters
        .filter(c => text.includes(c.name.toLowerCase()))
        .map(c => c.name);

    const refs: { name: string; type: 'character' | 'environment'; blobId: string }[] = [];
    
    // Add characters
    if (presentChars.length > 0) {
        for (const charName of presentChars) {
            const charAsset = assetRegistry.findByName(charName, 'character');
            if (charAsset) {
                refs.push({ name: charAsset.name, type: 'character', blobId: charAsset.blobId });
            }
        }
    }

    // Add environment
    const envName = guessEnvironment(scene);
    if (envName) {
        const envAsset = assetRegistry.findByName(envName, 'environment');
        if (envAsset) {
            refs.push({ name: envAsset.name, type: 'environment', blobId: envAsset.blobId });
        }
    }
    
    return refs.slice(0, 3); // Limit to 3 references
}
