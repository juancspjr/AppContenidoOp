/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// FIX: Added GenerateContentResponse, GenerateImagesResponse, and GenerateVideosOperation to imports for proper type inference.
import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse, GenerateVideosOperation } from "@google/genai";
import { logger } from '../utils/logger';
// FIX: Import fileToGenerativePart utility for browser-compatible base64 encoding.
import { fileToGenerativePart, fileToBase64 } from '../utils/fileUtils';
import { parseJsonMarkdown } from '../utils/parserUtils';
import type { 
    AIRecommendation, 
    CharacterDefinition,
    InitialConcept,
    StyleAndFormat,
    StoryStructure,
    // FIX: Import the 'StructuralCoherenceReport' type to resolve 'Cannot find name' errors.
    StructuralCoherenceReport,
    StoryMasterplan,
    Critique,
    Documentation,
    HookMatrix,
    ReferenceAsset,
    CoherenceCheckItem,
    AIStyleSuggestion
} from '../components/story-builder/types';
import { PersistentAPIKeyManager, APIKeyStatus } from './apiKeyBlacklist';
import geminiWebService from "./geminiWebService";


// ====================================================================================
//  simulated backend proxy.
// ====================================================================================

// In a real app, these would be environment variables on a server.
// For this simulation, they are encapsulated here and not exposed to the rest of the app.
const MOCKED_API_KEYS = [
    { id: 'key1', key: process.env.API_KEY || 'default_mock_key_1', projectName: 'Gemini-Flash-A' },
    { id: 'key2', key: process.env.API_KEY_2 || 'default_mock_key_2', projectName: 'Gemini-Flash-B' },
    { id: 'key3', key: process.env.API_KEY_3 || 'default_mock_key_3', projectName: 'Imagen-4-A' },
    { id: 'key4', key: process.env.API_KEY_4 || 'default_mock_key_4', projectName: 'Veo-2-A' },
];

let globalRequestQueue = Promise.resolve();

// FIX: Corrected model names in the function signature to use dots for versioning (e.g., '4.0') instead of hyphens, aligning with actual model identifiers and fixing type errors.
async function makeApiRequestWithRetry<T>(
    requestFn: (ai: GoogleGenAI) => Promise<T>,
    modelName: 'gemini-2.5-flash' | 'imagen-4.0-generate-001' | 'veo-2.0-generate-001' | 'gemini-2.5-flash-image-preview'
): Promise<T> {
    
    const requestPromise = new Promise<T>(async (resolve, reject) => {
        const availableKeys = PersistentAPIKeyManager.getAvailableAPIs(MOCKED_API_KEYS);
        
        if (availableKeys.length === 0) {
            logger.log('ERROR', 'geminiService', 'No available API keys in the pool.');
            return reject(new Error("Todas las claves de API están actualmente agotadas o bloqueadas. Por favor, espera o resetea el estado de las claves."));
        }

        let lastError: any = null;

        for (const key of availableKeys) {
            try {
                const ai = new GoogleGenAI({ apiKey: key.key });
                const result = await requestFn(ai);
                PersistentAPIKeyManager.markAsSuccessful(key.id, key);
                logger.log('SUCCESS', 'geminiService', `API request successful with key ${key.projectName} for model ${modelName}.`);
                return resolve(result);
            } catch (error: any) {
                lastError = error;
                const errorMessage = error.message || 'Unknown error';
                logger.log('WARNING', 'geminiService', `API request failed for key ${key.projectName}. Error: ${errorMessage}`);
                PersistentAPIKeyManager.markAsExhausted(key.id, key, errorMessage);
            }
        }
        
        logger.log('ERROR', 'geminiService', 'All available API keys failed.', lastError);
        reject(lastError || new Error("Todas las claves de API disponibles fallaron."));
    });

    // Serialize all requests through the global queue
    // FIX: Corrected promise chaining to ensure the global queue promise resolves to void, fixing the type error.
    globalRequestQueue = globalRequestQueue.then(() => requestPromise).catch(() => {}).then(() => {});
    return requestPromise;
}

// Photo Editor AI Services
export async function getAIRecommendations(imageFile: File, presets: { name: string, prompt: string, description: string }[], context: string): Promise<AIRecommendation[]> {
    const generativePart = await fileToGenerativePart(imageFile);
    
    const prompt = `Analyze this image. Based on its content, style, and quality, recommend the top 5 most suitable adjustments from the provided list to enhance it. Also, suggest an optimal color balance adjustment (r, g, b values from -25 to 25).

Context from the user: "${context || 'None provided'}"

Analyze based on:
- Subject matter (portrait, landscape, etc.)
- Lighting conditions (over/underexposed, contrast)
- Color palette (vibrancy, temperature)
- Composition and mood

List of available presets:
${presets.map(p => `- ${p.name}: ${p.description}`).join('\n')}

Respond ONLY with a JSON array in the following format:
[
  {"presetName": "Name of Preset", "reason": "Your brief reasoning for this recommendation."},
  ...
  {"colorBalance": {"r": <number>, "g": <number>, "b": <number>}, "reason": "Your reasoning for the color balance adjustment."}
]`;

    // FIX: Explicitly typed the response to GenerateContentResponse to resolve 'unknown' type error on 'result.text'.
    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [generativePart, { text: prompt }] },
            config: { responseMimeType: 'application/json' }
        }),
        'gemini-2.5-flash'
    );
    
    return parseJsonMarkdown(result.text);
}


export async function getAIFilterRecommendations(imageFile: File, presets: { name: string, prompt: string }[], context: string): Promise<{ presetName: string, reason: string }[]> {
    const generativePart = await fileToGenerativePart(imageFile);
    
    const prompt = `Analyze this image. Based on its content, style, and mood, recommend the top 5 most suitable creative filters from the provided list.

Context from the user: "${context || 'None provided'}"

Analyze based on:
- Subject matter (portrait, landscape, urban, etc.)
- Existing mood (happy, somber, dramatic)
- Potential for artistic transformation

List of available filters:
${presets.map(p => `- ${p.name}`).join('\n')}

Respond ONLY with a JSON array in the following format:
[
  {"presetName": "Name of Filter", "reason": "Your brief reasoning for this recommendation."},
  ...
]`;

    // FIX: Explicitly typed the response to GenerateContentResponse to resolve 'unknown' type error on 'result.text'.
    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [generativePart, { text: prompt }] },
            config: { responseMimeType: 'application/json' }
        }),
        'gemini-2.5-flash'
    );
    
    return parseJsonMarkdown(result.text);
}


// Story Builder Services

export async function assistConcept(idea: string): Promise<InitialConcept> {
    logger.log('DEBUG', 'geminiService', 'assistConcept called with real AI', { idea });
    
    const prompt = `Actúa como un co-escritor creativo y experto en marketing viral. Toma la idea inicial del usuario y expándela.

**REGLAS ESTRICTAS:**
1.  Refina la 'idea' central para que sea más atractiva, concisa y potente.
2.  Sugiere un 'targetAudience' (público objetivo) muy específico, detallado e interesante.
3.  Genera una lista de 3 a 5 'keyElements' (elementos clave). **IMPORTANTE:** Este campo DEBE ser un array de strings simples y cortos (ej: ["Amistad inesperada", "Sacrificio heroico"]). No debe ser un objeto con claves y valores.
4.  Responde SIEMPRE en español.
5.  Responde ÚNICAMENTE con un objeto JSON válido que siga este formato exacto. No incluyas texto adicional ni markdown.

**FORMATO JSON OBLIGATORIO:**
{
  "idea": "Tu idea refinada aquí.",
  "targetAudience": "Tu público objetivo sugerido aquí.",
  "keyElements": ["Elemento clave conciso 1", "Elemento clave conciso 2", "Elemento clave conciso 3"]
}

**Idea del Usuario:** "${idea}"`;

    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }),
        'gemini-2.5-flash'
    );
    
    return parseJsonMarkdown(result.text);
}

export async function orchestrateStyleGeneration(concept: InitialConcept, currentStyle: StyleAndFormat | null): Promise<AIStyleSuggestion> {
    logger.log('DEBUG', 'geminiService', 'orchestrateStyleGeneration called with intelligent autofill', { concept, currentStyle });

    const allCategories: (keyof StyleAndFormat)[] = ['outputFormat', 'narrativeStyle', 'visualStyle', 'narrativeStructure', 'hook', 'conflict', 'ending'];
    const lockedCategories: Partial<StyleAndFormat> = {};
    const openCategories: (keyof StyleAndFormat)[] = [];

    // FIX: Refactored loop to use `Array.isArray` for safer type checking, avoiding potential runtime errors with type casting.
    for (const category of allCategories) {
        const value = currentStyle?.[category];
        if (Array.isArray(value) && value.length > 0) {
            lockedCategories[category] = value;
        } else {
            openCategories.push(category);
        }
    }

    if (openCategories.length === 0) {
        logger.log('INFO', 'geminiService', 'All categories are already filled by the user. No AI suggestion needed.');
        return { styleNotesSuggestion: 'Todas las categorías ya han sido completadas por el usuario.' };
    }

    const jsonSchemaForAI = openCategories.map(cat => `"${cat}": ["string", "string", ...]`).join(',\n    ');

    const prompt = `Actúa como un Director Creativo experto. Tu misión es autocompletar de forma inteligente un plan de estilo.

**1. CONTEXTO (Decisiones ya tomadas por el usuario):**
*   **Concepto Central:**
    *   Idea: "${concept.idea}"
    *   Público Objetivo: "${concept.targetAudience}"
    *   Elementos Clave: ${concept.keyElements.join(', ')}
*   **Selecciones de Estilo del Usuario (Respétalas):**
    *   ${JSON.stringify(lockedCategories, null, 2)}
*   **Notas del Usuario (Considera su intención):**
    *   "${currentStyle?.styleNotes || 'Ninguna.'}"

**2. TU TAREA (Estricta y Obligatoria):**
*   **Autocompleta ÚNICAMENTE las categorías que están vacías.**
*   Para CADA UNA de las siguientes categorías vacías: **[${openCategories.join(', ')}]**:
    *   **DEBES GENERAR un array de 2 a 4 sugerencias** que sean creativas y **100% coherentes** con el contexto proporcionado.
*   **DEBES GENERAR una nota de estilo adicional** en el campo \`styleNotesSuggestion\`, resumiendo la visión combinada.
*   Tu respuesta debe ser **SIEMPRE en español**.

**3. FORMATO DE SALIDA (JSON VÁLIDO Y OBLIGATORIO):**
*   Tu respuesta debe ser ÚNICAMENTE un objeto JSON que contenga **SOLO las claves de las categorías que has completado**. No incluyas las categorías que el usuario ya llenó.

**EJEMPLO DE FORMATO DE RESPUESTA JSON:**
{
    ${jsonSchemaForAI},
    "styleNotesSuggestion": "Basado en tus elecciones, propongo una estética visual vibrante que contraste con un humor negro, manteniendo un ritmo rápido para redes sociales."
}`;

    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }),
        'gemini-2.5-flash'
    );
    
    return parseJsonMarkdown(result.text);
}

export async function suggestCharacterRelationships(characters: CharacterDefinition[]): Promise<CharacterDefinition[]> {
     const prompt = `Based on the following character definitions, suggest compelling relationships between them. Update the 'relationships' array for each character.

Characters:
${JSON.stringify(characters, null, 2)}

Respond ONLY with the full, updated JSON array of characters.`;

    // FIX: Explicitly typed the response to GenerateContentResponse to resolve 'unknown' type error on 'result.text'.
    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }),
        'gemini-2.5-flash'
    );
    
    return parseJsonMarkdown(result.text);
}

// API Management and Validation
export function resetAllAPIs() {
    PersistentAPIKeyManager.resetAllAPIs();
}
export function resetSpecificAPI(projectName: string) {
    PersistentAPIKeyManager.resetSpecificAPI(projectName);
}
export function listAPIStatus(): APIKeyStatus[] {
    return PersistentAPIKeyManager.listAPIStatus(MOCKED_API_KEYS);
}
export function getAPIStats() {
    return PersistentAPIKeyManager.getStats(MOCKED_API_KEYS);
}
export async function runApiKeyValidationTest() {
    // FIX: Explicitly typed the response to GenerateContentResponse to resolve 'unknown' type error on 'result.text'.
    const result = await makeApiRequestWithRetry<GenerateContentResponse>(
        (ai) => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Respond with only the letters "OK".'
        }),
        'gemini-2.5-flash'
    );
    // This is a bit of a hack to find out which key was used.
    // In a real backend, we'd know this directly.
    const successfulKey = PersistentAPIKeyManager.listAPIStatus(MOCKED_API_KEYS).find(s => s.status === 'active' && s.lastUsedAt && s.lastError === undefined);

    return { responseText: result.text.trim(), keyUsedName: successfulKey?.projectName || 'Unknown' };
}
export function forceNextApiQuotaError() {
    return PersistentAPIKeyManager.forceQuotaErrorOnNextAvailable(MOCKED_API_KEYS);
}

// Dummy implementations for unprovided services from story builder
export const assistNewCharacter = async (charData: Partial<CharacterDefinition>): Promise<Partial<CharacterDefinition>> => {
    logger.log('DEBUG', 'geminiService', 'assistNewCharacter called', charData);
    await new Promise(res => setTimeout(res, 1000));
    return {
        ...charData,
        name: charData.name || 'Sparky',
        description: 'A small, optimistic robot with a big heart.',
        archetype: 'The Innocent',
        motivation: { desire: 'To see the world', fear: 'Being alone', need: 'To find a family' },
        flaw: 'Too trusting',
        arc: 'From naive helper to brave hero'
    };
};

export const assistCharacter = async (character: CharacterDefinition): Promise<CharacterDefinition> => {
    logger.log('DEBUG', 'geminiService', 'assistCharacter called', character);
    await new Promise(res => setTimeout(res, 1000));
    return { ...character, description: character.description + " (Enhanced by AI)." };
};


export const generateStructure = async (concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[]): Promise<StoryStructure> => {
    logger.log('DEBUG', 'geminiService', 'generateStructure called');
    await new Promise(res => setTimeout(res, 2000));
    return {
        act1_summary: "Act 1: Introduction of characters and setup.",
        act2_summary: "Act 2: Rising action and conflict.",
        act3_summary: "Act 3: Climax and resolution."
    };
}
export const runCoherenceCheck = async (structure: StoryStructure): Promise<StructuralCoherenceReport> => {
    logger.log('DEBUG', 'geminiService', 'runCoherenceCheck called');
    await new Promise(res => setTimeout(res, 3000));
    return {
        coherenceScore: 7.5,
        overallAssessment: "The structure is solid but could use more specific emotional beats in Act 2.",
        checks: [
            { id: 'chk1', element: 'Pacing', concern: 'Act 2 feels a bit rushed.', suggestion: 'Add a scene where the protagonist reflects on their recent failure.', severity: 'medium' },
            { id: 'chk2', element: 'Character Arc', concern: 'The antagonist\'s motivation is unclear.', suggestion: 'Add a brief flashback or line of dialogue explaining why they are so driven.', severity: 'high' }
        ]
    };
}
export const applyCoherenceFixes = async (structure: StoryStructure, fixes: CoherenceCheckItem[]): Promise<StoryStructure> => {
     logger.log('DEBUG', 'geminiService', 'applyCoherenceFixes called');
    await new Promise(res => setTimeout(res, 1000));
    return {
        ...structure,
        act2_summary: structure.act2_summary + "\n- Added reflection scene as per AI suggestion.",
    };
}
export const generateMasterplan = async (concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[], structure: StoryStructure): Promise<StoryMasterplan> => {
    logger.log('DEBUG', 'geminiService', 'generateMasterplan called');
    await new Promise(res => setTimeout(res, 2000));
    return {
        metadata: { title: 'AI Story', logline: 'A robot finds a friend.' },
        story_structure: {
            narrative_arc: [
                { act_number: 1, title: 'The Beginning', summary: 'Intro', scenes: [{ scene_number: 1, title: 'First Scene', summary: 'Robot is lonely' }] },
                { act_number: 2, title: 'The Middle', summary: 'Conflict', scenes: [{ scene_number: 2, title: 'Second Scene', summary: 'Robot finds plant' }] },
                { act_number: 3, title: 'The End', summary: 'Resolution', scenes: [{ scene_number: 3, title: 'Third Scene', summary: 'Robot and plant are friends' }] },
            ]
        }
    };
}
export const runCritique = async (plan: StoryMasterplan): Promise<Critique> => {
    logger.log('DEBUG', 'geminiService', 'runCritique called');
    await new Promise(res => setTimeout(res, 1500));
    return {
        narrativeStrengths: ["Strong emotional core."],
        weaknesses: [{ point: 'Ending is abrupt.', suggestion: 'Add a final scene showing their future.' }],
        viralPotential: 8.2,
        improvementStrategies: [{ title: 'Focus on close-ups', description: 'Use close-ups to enhance emotional connection.' }],
        enrichedElements: {}
    };
}
export const applyImprovementsToPlan = async (plan: StoryMasterplan, critique: Critique): Promise<StoryMasterplan> => {
    logger.log('DEBUG', 'geminiService', 'applyImprovementsToPlan called');
    await new Promise(res => setTimeout(res, 1000));
    const newPlan = JSON.parse(JSON.stringify(plan));
    newPlan.story_structure.narrative_arc[2].scenes.push({ scene_number: 4, title: 'A Glimpse of the Future', summary: 'The robot and plant are shown one year later, thriving together.' });
    return newPlan;
}
export const generateDocumentation = async (plan: StoryMasterplan): Promise<Documentation> => {
    logger.log('DEBUG', 'geminiService', 'generateDocumentation called');
    await new Promise(res => setTimeout(res, 1000));
    return {
        directorsBible: "# Director's Bible\n...",
        aiProductionGuide: "# AI Production Guide\n...",
        visualStyleGuide: "# Visual Style Guide\n..."
    };
}
export const generateHookMatrix = async (plan: StoryMasterplan): Promise<HookMatrix> => {
    logger.log('DEBUG', 'geminiService', 'generateHookMatrix called');
    await new Promise(res => setTimeout(res, 1000));
    const hook = { template: "You won't believe what this robot does.", rationale: "Creates curiosity." };
    return {
        patternInterrupts: [hook],
        psychologicalTriggers: [hook],
        curiosityGaps: [hook],
        powerPhrases: [hook],
        provenStructures: [hook]
    };
}
export const generateReferenceAsset = async (asset: ReferenceAsset, plan: StoryMasterplan): Promise<Blob> => {
    logger.log('DEBUG', 'geminiService', 'generateReferenceAsset called for', asset.name);
    
    // Use the Gemini Web Service Fallback if available
    if (geminiWebService.isInitialized()) {
        try {
            logger.log('INFO', 'geminiService', `Using Gemini Web fallback for reference asset: ${asset.name}`);
            return await geminiWebService.generateImage(asset.prompt);
        } catch (error) {
            logger.log('WARNING', 'geminiService', `Gemini Web fallback failed for ${asset.name}. Falling back to standard API.`, error);
        }
    }
    
    // FIX: Explicitly typed the response to GenerateImagesResponse to resolve 'unknown' type error on 'result.generatedImages'.
    const result = await makeApiRequestWithRetry<GenerateImagesResponse>(
        (ai) => ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: asset.prompt,
            config: { numberOfImages: 1, aspectRatio: asset.aspectRatio }
        }),
        'imagen-4.0-generate-001'
    );
    const base64 = result.generatedImages[0].image.imageBytes;
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/png' });
};

export const generateVideoSegment = async (prompt: string, image?: File): Promise<string> => {
    logger.log('DEBUG', 'geminiService', 'generateVideoSegment called');

    // FIX: Explicitly typed response to GenerateVideosOperation, made inner function async, and replaced Node.js Buffer with browser-compatible fileToBase64.
    const result = await makeApiRequestWithRetry<GenerateVideosOperation>(
        async (ai) => ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: image ? { imageBytes: await fileToBase64(image), mimeType: image.type } : undefined,
            config: { numberOfVideos: 1 }
        }),
        'veo-2.0-generate-001'
    );
    // In a real scenario, we'd poll the operation. Here we simulate success.
    return result.response?.generatedVideos?.[0]?.video?.uri || '';
};

export const fetchVideo = async(uri: string): Promise<Blob> => {
    // This is a mock implementation.
    logger.log('DEBUG', 'geminiService', 'Fetching video from URI', uri);
    const response = await fetch(`https://picsum.photos/1080/1920`); // Placeholder fetch
    return response.blob();
}