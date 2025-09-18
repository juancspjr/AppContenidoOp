/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// This file simulates a backend service for security and advanced features.
// In a real application, this code would run on a server (e.g., Node.js).
import { GoogleGenAI, GenerateContentResponse, Modality, Part, Type, Content, GenerateContentParameters } from '@google/genai';
import { PersistentAPIKeyManager } from './apiKeyBlacklist';
import type { StoryData, StoryMasterplan, CharacterData, ProgressUpdate, FinalAssets, Documentation, Critique, GeneratedReferenceAssets, ReferenceAsset, Scene, AIRecommendation, ExportedProject, ImageAnalysis, ExportedReferenceAsset } from '@/components/story-builder/types';
import { imageBlobCache } from './imageBlobCache';
import { assetDBService } from './assetDBService';
import { assetRegistry } from './assetRegistry';
import { geminiWebService } from '@/services/geminiWebService';

// FIX: Add a browser-compatible way to convert ArrayBuffer to Base64, as Buffer is a Node.js API.
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// In a real backend, these would be loaded from environment variables.
const GEMINI_KEYS = Array.from({ length: 10 }, (_, i) => ({
    id: `key_${String(i + 1).padStart(2, '0')}`,
    api_key: `YOUR_API_KEY_${i + 1}`, // Placeholder
    projectName: `Pixshop Project ${String.fromCharCode(65 + i)}`
}));

// Per guidelines, if process.env.API_KEY is provided, it should be used.
// We'll treat it as the first key in our rotation pool.
if (process.env.API_KEY) {
    GEMINI_KEYS[0].api_key = process.env.API_KEY;
}

// A simple in-memory queue to serialize API requests to avoid race conditions and simplify rate limiting.
let requestQueue = Promise.resolve();
const throttleDelay = 1500; // 1.5 second delay between requests to stay within typical free-tier limits.
let lastRequestTimestamp = 0;

const makeApiRequest = <T>(requestFn: () => Promise<T>): Promise<T> => {
    const serializedRequest = requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLast = now - lastRequestTimestamp;
        if (timeSinceLast < throttleDelay) {
            const delay = throttleDelay - timeSinceLast;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        lastRequestTimestamp = Date.now();
        return requestFn();
    });

    // FIX: Ensure the promise chain assigned back to `requestQueue` always resolves to `void`
    // to match the initial type of `Promise.resolve()`.
    requestQueue = serializedRequest.catch(() => {
        // Prevent unhandled promise rejections from breaking the chain
    }).then(() => {}); 
    return serializedRequest;
};

const getGeminiClient = (): { client: GoogleGenAI, keyData: typeof GEMINI_KEYS[0] } => {
    const availableKeys = PersistentAPIKeyManager.getAvailableAPIs(GEMINI_KEYS);

    if (availableKeys.length === 0) {
        throw new Error("RESOURCE_EXHAUSTED: All API keys are currently exhausted. Please try again later or reset them in the developer tools.");
    }
    
    // Simple strategy: pick a random available key to distribute load.
    const keyData = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    const client = new GoogleGenAI({ apiKey: keyData.api_key });
    return { client, keyData };
};

async function makeApiRequestWithRetry<T>(
    requestFn: (client: GoogleGenAI) => Promise<T>,
    maxRetries = 3
): Promise<T> {
    let lastError: Error | null = null;
    // Use a copy of all keys for retry attempts, not just the currently "available" ones.
    const keysToTry = [...GEMINI_KEYS];

    for (let attempt = 0; attempt < maxRetries && keysToTry.length > 0; attempt++) {
        // Simple round-robin for retries
        const keyData = keysToTry.shift()!;
        const client = new GoogleGenAI({ apiKey: keyData.api_key });
        
        try {
            const result = await makeApiRequest(() => requestFn(client));
            PersistentAPIKeyManager.markAsSuccessful(keyData.id, keyData);
            return result;
        } catch (error) {
            console.error(`API request failed with key ${keyData.projectName} (Attempt ${attempt + 1}/${maxRetries}):`, error);
            lastError = error as Error;
            PersistentAPIKeyManager.markAsExhausted(keyData.id, keyData, (error as Error).message);
        }
    }
    throw new Error(`API request failed after exhausting available keys. Last error: ${lastError?.message}`);
}

const dataUrlToGoogleGenerativePart = (dataUrl: string): Part => {
    const [header, base64Data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    return {
        inlineData: {
            mimeType,
            data: base64Data,
        },
    };
};

// --- API Function Implementations ---

export async function refineUserPrompt(prompt: string, context: 'magic-edit' | 'filter' | 'adjustment'): Promise<string> {
    const systemInstruction = `You are an AI assistant specializing in image editing prompts. A user will provide a simple prompt and a context. Your task is to refine and expand the prompt to be more descriptive and effective for a generative AI image model. Return only the refined prompt text, nothing else. Context: ${context}`;
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction }
        })
    );
    return response.text.trim();
}

export async function generateMagicEditImage({ prompt, baseHoleDataURL, referenceDataURL }: { prompt: string; baseHoleDataURL: string; referenceDataURL?: string; }): Promise<Blob> {
    const parts: Part[] = [
        dataUrlToGoogleGenerativePart(baseHoleDataURL),
        { text: `Inpaint the transparent area of the provided image based on the following instruction: ${prompt}` },
    ];

    if (referenceDataURL) {
        parts.push(dataUrlToGoogleGenerativePart(referenceDataURL));
        parts.push({ text: "Use the second image as a style and content reference." });
    }

    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] },
        })
    );
    
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("API did not return an image for Magic Edit.");
    }
    
    const res = await fetch(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
    return res.blob();
}

export async function generateFilteredImage(image: File, prompt: string): Promise<string> {
     const imagePart = {
        inlineData: {
            mimeType: image.type,
            // FIX: Use browser-compatible ArrayBuffer to Base64 conversion instead of Node.js Buffer.
            data: arrayBufferToBase64(await image.arrayBuffer()),
        },
    };

    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, { text: `Apply this filter to the image: ${prompt}` }] },
            config: { responseModalities: [Modality.IMAGE] },
        })
    );

    const resultPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!resultPart || !resultPart.inlineData) {
        throw new Error("API did not return a filtered image.");
    }

    return `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
}

export const generateAdjustedImage = generateFilteredImage; // They use the same underlying model and logic.

export async function generatePhotoshootScene(subjectImage: File, scenePrompt: string, numImages: number, sceneImage: File | null): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < numImages; i++) {
        // FIX: Cast the response to the expected structure for generateImages.
        const response = await makeApiRequestWithRetry(client => 
            client.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `Photorealistic photoshoot. Subject is described by the first image. Scene is described by the text prompt and optional second image. Prompt: ${scenePrompt}. Shot ${i+1} of ${numImages}.`,
                config: { numberOfImages: 1 },
            })
        ) as { generatedImages: { image: { imageBytes: string } }[] };
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        results.push(`data:image/png;base64,${base64ImageBytes}`);
    }
    return results;
}

export async function getAIRecommendations(image: File, presets: any[], context: string): Promise<AIRecommendation[]> {
    // This is a simplified implementation for demonstration.
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the provided image. Based on the following presets, recommend the top 3 that would most improve the image. Context: "${context}". Presets: ${JSON.stringify(presets.map(p => p.name))}. Respond in JSON format: [{ "presetName": "...", "reason": "..." }]`,
            config: { responseMimeType: 'application/json' }
        })
    );
    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse AI recommendations:", e);
        return [];
    }
}

export const getAIFilterRecommendations = getAIRecommendations;

// --- Funciones auxiliares para FASE 6.3 ---

async function hashFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function guessEnvironment(scene: Scene): string | null {
    if (!scene) return null;
    const t = `${scene.title || ''} ${scene.summary || ''} ${scene.visual_description || ''}`.toLowerCase();
    const map = [
        { k: ['pasillo', 'hallway', 'palacio', 'palace'], v: 'Pasillo del Palacio' },
        { k: ['sala de control', 'control room'], v: 'Sala de Control' },
        { k: ['oficina', 'office'], v: 'Oficina Central' },
        { k: ['plaza', 'square'], v: 'Plaza Principal' },
        { k: ['laboratorio', 'laboratory'], v: 'Laboratorio Secreto' },
    ];
    for (const m of map) if (m.k.some(k => t.includes(k))) return m.v;
    return null;
}

function extractUniqueEnvironments(plan: StoryMasterplan): string[] {
    const set = new Set<string>();
    if (!plan?.story_structure?.narrative_arc) return [];
    for (const act of plan.story_structure.narrative_arc) {
        if (!act?.scenes) continue;
        for (const scene of act.scenes) {
            if (!scene) continue;
            const env = guessEnvironment(scene);
            if (env) set.add(env);
        }
    }
    return Array.from(set);
}

function extractUniqueProps(plan: StoryMasterplan): string[] {
    const set = new Set<string>();
    if (!plan?.story_structure?.narrative_arc) return [];
    for (const act of plan.story_structure.narrative_arc) {
        if (!act?.scenes) continue;
        for (const scene of act.scenes) {
            if (!scene) continue;
            const t = `${scene.title || ''} ${scene.summary || ''} ${scene.visual_description || ''} ${scene.dialogue_or_narration || ''}`.toLowerCase();
            if (t.includes('suppressor') || t.includes('supresor')) set.add('Audience Perception Suppressor');
            if (t.includes('dispositivo inteligente') || t.includes('smart')) set.add('Smart Device');
        }
    }
    return Array.from(set);
}

function countUniqueEnvironments(plan: StoryMasterplan): number {
    return extractUniqueEnvironments(plan).length;
}

function countUniqueProps(plan: StoryMasterplan): number {
    return extractUniqueProps(plan).length;
}

function buildCharacterPromptConsistent(char: any, plan: StoryMasterplan, userData: StoryData): string {
    const styles = plan.metadata.style_and_energy?.visual_styles?.join(', ') || userData.visualStyles?.join(', ') || 'cinematic 3D';
    return [
        `High-consistency character portrait of ${char.name}`,
        `${char.description}`,
        'Create a portrait with high visual consistency to the reference image if one is provided.',
        'Focus on maintaining facial structure, key features like moustaches, and body proportions.',
        'Keep wardrobe details and decorations consistent.',
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

async function generateWithGeminiFlashRefs(prompt: string, aspect: ReferenceAsset['aspectRatio'], refs: { name: string; type: string; blobId: string }[]) {
    const parts: Part[] = [];

    for (const r of refs) {
        const b = imageBlobCache.get(r.blobId);
        if (!b) continue;
        const buf = new Uint8Array(await b.arrayBuffer());
        const base64 = btoa(String.fromCharCode(...buf));
        parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
        parts.push({ text: `Reference: ${r.type} "${r.name}". Keep identity/style exactly.` });
    }

    parts.push({ text: `${prompt}, aspect ratio ${aspect}, vertical mobile framing` });
    
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client =>
        client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        })
    );
    
    const img = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!img?.inlineData) throw new Error('No image returned');
    const res = await fetch(`data:${img.inlineData.mimeType};base64,${img.inlineData.data}`);
    return res.blob();
}

function buildSceneReferencePack(scene: Scene, plan: StoryMasterplan) {
    if (!scene) return [];
    const text = `${scene.title || ''} ${scene.summary || ''} ${scene.visual_description || ''}`.toLowerCase();
    const presentChars = (plan.characters || [])
        .filter(c => c && c.name && text.includes(c.name.toLowerCase()))
        .map(c => c.name);

    const refs: { name: string; type: 'character' | 'environment'; blobId: string }[] = [];

    if (presentChars.length > 0) {
        const main = assetRegistry.findByName(presentChars[0], 'character');
        if (main) refs.push({ name: main.name, type: 'character', blobId: main.blobId });
    }
    if (presentChars.length > 1) {
        const sec = assetRegistry.findByName(presentChars[1], 'character');
        if (sec && !refs.some(r => r.blobId === sec.blobId)) refs.push({ name: sec.name, type: 'character', blobId: sec.blobId });
    }

    const env = guessEnvironment(scene);
    if (env) {
        const envAsset = assetRegistry.findByName(env, 'environment');
        if (envAsset) refs.push({ name: envAsset.name, type: 'environment', blobId: envAsset.blobId });
    }
    return refs.slice(0, 3);
}

export async function generateReferenceAssetsPhase63(
    plan: StoryMasterplan,
    userData: StoryData,
    aspectRatio: '9:16' | '1:1' | '16:9' | '4:5',
    onProgress?: (current: number, total: number, message: string) => void
): Promise<Omit<GeneratedReferenceAssets, 'sceneFrames'>> {
    const charactersToGen = plan.characters || [];
    const totalPlanned = charactersToGen.length + countUniqueEnvironments(plan) + countUniqueProps(plan);
    let current = 0; 
    const step = (msg: string) => {
        current++;
        onProgress?.(current, totalPlanned, msg);
    };

    const characters: ReferenceAsset[] = [];
    for (const character of charactersToGen) {
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

        assetRegistry.add({
          id,
          name: character.name,
          type: 'character',
          tags: ['reference','identity-lock'],
          aspectRatio,
          prompt,
          blobId: id,
          sourcePhase: 'phase6.3',
          originHash
        });

        characters.push({
          id,
          name: character.name,
          type: 'character',
          prompt,
          aspectRatio,
          source: userChar?.image ? 'hybrid' : 'generated'
        });
    }

    const environments: ReferenceAsset[] = [];
    for (const envName of extractUniqueEnvironments(plan)) {
        if (assetRegistry.findByName(envName, 'environment')) continue;
        step(`Generando ambiente: ${envName}`);
        const envPrompt = buildEnvironmentPrompt(envName, plan, userData);
        const blob = await generateImageWithFallback(envPrompt, aspectRatio);
        const id = crypto.randomUUID();
        imageBlobCache.set(id, blob);

        assetRegistry.add({
          id,
          name: envName,
          type: 'environment',
          tags: ['location','reference','style-sheet'],
          aspectRatio,
          prompt: envPrompt,
          blobId: id,
          sourcePhase: 'phase6.3'
        });

        environments.push({
          id,
          name: envName,
          type: 'environment',
          prompt: envPrompt,
          aspectRatio,
          source: 'generated'
        });
    }

    const elements: ReferenceAsset[] = [];
    for (const propName of extractUniqueProps(plan)) {
        if (assetRegistry.findByName(propName, 'element')) continue;
        step(`Generando elemento clave: ${propName}`);
        const propPrompt = buildPropPrompt(propName, plan, userData);
        const blob = await generateImageWithFallback(propPrompt, aspectRatio);
        const id = crypto.randomUUID();
        imageBlobCache.set(id, blob);

        assetRegistry.add({
          id,
          name: propName,
          type: 'element',
          tags: ['prop','reference','sheet'],
          aspectRatio,
          prompt: propPrompt,
          blobId: id,
          sourcePhase: 'phase6.3'
        } as any);

        elements.push({
          id,
          name: propName,
          type: 'element',
          prompt: propPrompt,
          aspectRatio,
          source: 'generated'
        });
    }

    return { characters, environments, elements };
}


// --- Story Builder Functions (Simplified Stubs) ---

export async function generateAdvancedStoryPlan(storyData: StoryData): Promise<{ plan: StoryMasterplan }> {
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Create a detailed story masterplan in JSON format based on this data: ${JSON.stringify(storyData)}. The JSON must match the StoryMasterplan interface structure.`,
            config: { responseMimeType: 'application/json' }
        })
    );
    return { plan: JSON.parse(response.text) };
}

export async function generateAllDocumentation(plan: StoryMasterplan): Promise<Documentation> {
    return {
        aiProductionGuide: "## AI Production Guide\n\n- Use prompts from the plan directly...",
        directorsBible: `# Director's Bible: ${plan.metadata.title}\n\nLogline: ${plan.metadata.logline}`,
        visualStyleGuide: `## Visual Style Guide\n\n- Primary style: ${plan.metadata.style_and_energy.visual_styles.join(', ')}`,
    };
}

export async function generateCritique(plan: StoryMasterplan, storyData: StoryData): Promise<Critique> {
    // Dummy critique for demonstration
    return {
        projectSummary: { about: "A promising project.", keyElements: [], identifiedStrengths: [] },
        verticalFormatEvaluation: { title: "Format Evaluation", strengths: ["Good hook"], weaknesses: { title: "Pacing", points: ["Could be faster"] } },
        improvementStrategy: { title: "Improvement Strategy", strategies: [] },
        specificImprovements: { title: "Specifics", visualSimplification: { title: "Simplify", keyElements: [] }, audioOptimization: "" },
        proposedSolution: { title: "Proposed Solution", solutionTitle: "Refactor", episodes: [] },
        finalRecommendation: { title: "Final Rec", recommendation: "Proceed with caution" },
        implementationPlan: { title: "Implementation", nextSteps: [], requiredResources: [] },
    };
}

export async function regenerateStoryPlanWithCritique(plan: StoryMasterplan, critique: Critique, onProgress: (phase: string, message: string) => void): Promise<StoryMasterplan> {
    onProgress('start', 'Regenerating plan...');
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Regenerate this story plan: ${JSON.stringify(plan)} by applying these critiques: ${JSON.stringify(critique)}. Output valid JSON.`,
            config: { responseMimeType: 'application/json' }
        })
    );
    onProgress('complete', 'Plan regenerated.');
    return JSON.parse(response.text);
}

export async function runFinalVideoGenerationPipeline(plan: StoryMasterplan, assets: GeneratedReferenceAssets, guide: string, onProgress: (update: ProgressUpdate) => void): Promise<FinalAssets> {
    onProgress({ stage: 'sub_prompts', status: 'in_progress', message: 'Generating video prompts...' });
    
    // Simulate video generation
    await new Promise(res => setTimeout(res, 2000));
    
    const finalAssets: FinalAssets = { videoAssets: [], imageAssets: [], audioAssets: [] };
    
    const scenes = plan.story_structure.narrative_arc.flatMap(act => act.scenes);

    for (const scene of scenes) {
        const sceneId = `scene_${scene.scene_number}`;
        onProgress({ sceneId, stage: 'videos', status: 'in_progress', message: 'Generating video segment...', segment: 1, totalSegments: 1 });
        
        // This is where a call to a video model like VEO would happen.
        // We will simulate it by creating a dummy video blob.
        const canvas = document.createElement("canvas");
        canvas.width = 100; canvas.height = 100;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "blue";
        ctx.fillRect(0, 0, 100, 100);
        const stream = canvas.captureStream();
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        
        const videoGenerated = new Promise<Blob>(resolve => {
            recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        });
        
        recorder.start();
        setTimeout(() => recorder.stop(), 500);
        const videoBlob = await videoGenerated;

        const assetId = crypto.randomUUID();
        imageBlobCache.set(assetId, videoBlob);
        finalAssets.videoAssets.push({ sceneId, segment: 1, assetId, prompt: scene.visual_description });
        
        onProgress({ sceneId, stage: 'videos', status: 'complete', message: 'Segment complete.', segment: 1, totalSegments: 1 });
    }
    
    onProgress({ stage: 'complete', status: 'complete', message: 'All videos generated.' });
    return finalAssets;
}

export function cancelCurrentGeneration() {
    // In a real app, this would use an AbortController to cancel fetch requests.
    // For this simulation, we can just log it.
    console.log("Generation cancellation requested.");
    // We could also reset the requestQueue, but that might be too disruptive.
}

export async function downloadProjectLocally(plan: StoryMasterplan, documentation: Documentation, assets: GeneratedReferenceAssets, critique: Critique | null): Promise<void> {
    // In a real app, you'd use a library like JSZip. For this fix, we'll download just the plan.
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${plan.metadata.title.replace(/\s+/g, '_')}_project.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}


// Placeholder functions
export async function generateStoryFromPrompt(prompt: string): Promise<any> { return {}; }
export async function generateOptimizedReferenceAssets(plan: StoryMasterplan, onProgress: (update: any) => void): Promise<any> { return {}; }
export async function generateCharacterWithReference(char: CharacterData, plan: StoryMasterplan): Promise<any> { return {}; }


// API Key Management Functions
export function resetAllAPIs() {
    PersistentAPIKeyManager.resetAllAPIs();
}

export function resetSpecificAPI(projectName: string) {
    const key = GEMINI_KEYS.find(k => k.projectName === projectName);
    if (key) {
        // FIX: Corrected typo from `PersistentAPIKeyKeyManager` to `PersistentAPIKeyManager`.
        const statusMap = PersistentAPIKeyManager.loadAPIStatus();
        statusMap.delete(key.id);
        PersistentAPIKeyManager.saveAPIStatus(statusMap);
    }
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
    onProgress(`Generando frame para escena ${scene.scene_number} con referencias...`);
    
    const finalPrompt = `Generate a cinematic keyframe for scene ${scene.scene_number} (${scene.title}) at its '${frameType}' moment. Visuals: ${scene.visual_description}. Style: ${plan.metadata.style_and_energy.visual_styles.join(', ')}. Keep identity/style exactly as the referenced character images. Do not change face geometry, moustache, or wardrobe. Use the referenced environment as visual base. One clear main subject, no extra people, no identity drift.`;
    
    const refs = buildSceneReferencePack(scene, plan);
    const blob = await generateWithGeminiFlashRefs(finalPrompt, aspectRatio, refs);
    
    const newFrame: ReferenceAsset = {
        id: crypto.randomUUID(),
        name: `Scene ${scene.scene_number} - ${frameType}`,
        type: 'scene_frame',
        prompt: finalPrompt,
        aspectRatio,
        source: 'generated_hybrid_neural',
        sceneNumber: scene.scene_number,
        frameType,
    };
    imageBlobCache.set(newFrame.id, blob);
    return newFrame;
}


async function generateWithGeminiAPI(prompt: string, aspectRatio: ReferenceAsset['aspectRatio'], options?: { referenceImage?: File; }) {
    const parts: Part[] = [{ text: prompt }];
    if (options?.referenceImage) {
        const file = options.referenceImage;
        // FIX: Use browser-compatible ArrayBuffer to Base64 conversion instead of Node.js Buffer.
        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        parts.unshift({ inlineData: { mimeType: file.type, data: base64 } });
    }
    
    // FIX: Explicitly type the response to resolve property access errors.
    const response: GenerateContentResponse = await makeApiRequestWithRetry(client => 
        client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        })
    );
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData) {
        throw new Error("No se encontró data de imagen en la respuesta de Gemini API");
    }
    const res = await fetch(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
    return res.blob();
}

async function generateWithImagen(prompt: string, aspectRatio: ReferenceAsset['aspectRatio']) {
    // FIX: Cast the response to the expected structure for generateImages.
    const response = await makeApiRequestWithRetry(client => 
        client.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { 
                numberOfImages: 1, 
                outputMimeType: 'image/png', 
                aspectRatio: aspectRatio === '4:5' ? '3:4' : aspectRatio 
            },
        })
    ) as { generatedImages: { image: { imageBytes: string } }[] };
    if (!response.generatedImages?.[0]?.image?.imageBytes) {
        throw new Error(`Fallback a Imagen-4.0 falló para prompt: "${prompt.substring(0, 100)}..."`);
    }
    
    const res = await fetch(`data:image/png;base64,${response.generatedImages[0].image.imageBytes}`);
    return res.blob();
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
    }
): Promise<Blob> {
    
    const { referenceImage } = options || {};
    
    // AÑADIR ESPECIFICACIONES DE ASPECT RATIO
    const aspectPrompt = aspectRatio === '9:16' 
        ? 'vertical 9:16 aspect ratio, mobile composition, portrait orientation' 
        : `${aspectRatio} aspect ratio`;
        
    const enhancedPrompt = `${prompt}, ${aspectPrompt}, high quality, professional rendering, sharp focus, detailed`;
    
    try {
        // INTENTAR API OFICIAL PRIMERO
        console.log("%c🟢 PRIMARIO: Gemini API Oficial", "color: lightgreen; font-weight: bold;");
        return await generateWithGeminiAPI(enhancedPrompt, aspectRatio, options);
        
    } catch (apiError: any) {
        console.warn(`%c🟡 API FALLÓ: ${apiError.message}`, "color: orange; font-weight: bold;");
        
        // FALLBACK 1: GEMINI WEB (SI ESTÁ INICIALIZADO)
        if (geminiWebService.isInitialized()) {
            try {
                console.log("%c🌐 FALLBACK GEMINI WEB: Generación ilimitada activa", "color: cyan; font-weight: bold;");
                
                let referenceBase64: string | undefined;
                
                // CONVERTIR IMAGEN DE REFERENCIA A BASE64 SI EXISTE
                if (referenceImage) {
                    referenceBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            const base64 = result.split(',')[1]; // Remover prefijo data:image/...;base64,
                            resolve(base64);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(referenceImage);
                    });
                }
                
                // GENERAR IMAGEN CON GEMINI WEB
                const image = await geminiWebService.generateImage(enhancedPrompt, referenceBase64);
                
                console.log("%c✅ ÉXITO: Imagen generada con Gemini Web", "color: cyan; font-weight: bold;");
                return image;
                
            } catch (webError: any) {
                console.warn(`%c🟡 GEMINI WEB FALLÓ: ${webError.message}`, "color: orange; font-weight: bold;");
            }
        } else {
            console.warn("%c⚠️ GEMINI WEB NO CONECTADO - Usa el botón de conexión", "color: orange; font-weight: bold;");
        }
        
        // FALLBACK 2: IMAGEN-4.0 (ORIGINAL)
        console.log("%c🔶 FALLBACK FINAL: Imagen-4.0", "color: orange; font-weight: bold;");
        return await generateWithImagen(enhancedPrompt, aspectRatio);
    }
}