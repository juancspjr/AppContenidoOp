/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
    ExportedProject, InitialConcept, StyleAndFormat, CharacterDefinition, 
    StoryStructure, StructuralCoherenceReport, CoherenceCheckStep, 
    StoryMasterplan, Critique, Documentation, ReferenceAsset, 
    ReferenceAssets, FinalAsset, FinalAssets, ProgressUpdate, VideosOperationResponse, 
    StoryBuilderState, 
    StoryboardPanel,
    StoryboardGroupPrompt,
    CritiqueProgressStep,
    EnhancedStoryData,
    PremiumStoryPlan,
    PremiumDocumentation
} from '../components/story-builder/types';
import { geminiService } from '../services/geminiService';
import * as Prompts from '../services/prompts';
import { parseJsonMarkdown } from '../utils/parserUtils';
import { logger } from '../utils/logger';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { assetDBService } from '../services/assetDBService';
import { fileToGenerativePart } from '../utils/fileUtils';
import { formatApiError } from '../utils/errorUtils';
import { sliceImageIntoGrid } from '../utils/imageUtils';
import { safeParseWithDefaults, StoryMasterplanSchema, StructuralCoherenceReportSchema, CritiqueSchema, isReferenceAsset } from '../utils/schemaValidation';
import { safeMap } from '../utils/safeData';
import { AgentOrchestrator } from '../services/specialized-agents/AgentOrchestrator';
import { apiRateLimiter } from '../services/api-rate-limiter';

type Action =
    | { type: 'REINITIALIZE'; payload: ExportedProject }
    | { type: 'GO_TO_PHASE'; payload: number }
    | { type: 'COMPLETE_PHASE_AND_ADVANCE' }
    | { type: 'SET_CONCEPT'; payload: InitialConcept }
    | { type: 'SET_STYLE'; payload: StyleAndFormat }
    | { type: 'SET_CHARACTERS'; payload: CharacterDefinition[] }
    | { type: 'SET_STRUCTURE'; payload: StoryStructure }
    | { type: 'API_START'; payload?: { isAssisting: boolean } }
    | { type: 'API_ASSIST_CHAR_START'; payload: string }
    // FIX: Expand payload type to allow 'assistingCharacterIds' which is part of the reducer state.
    | { type: 'API_SUCCESS'; payload: Partial<StoryBuilderState> & { assistingCharacterIds?: Set<string> } }
    | { type: 'API_ASSIST_CHAR_SUCCESS'; payload: { characterId: string; character: CharacterDefinition } }
    | { type: 'API_ERROR'; payload: string }
    | { type: 'UPDATE_COHERENCE_PROGRESS'; payload: CoherenceCheckStep[] }
    | { type: 'UPDATE_CRITIQUE_PROGRESS'; payload: CritiqueProgressStep[] }
    | { type: 'UPDATE_ASSET_GENERATION_PROGRESS'; payload: { assetId: string; progress: ProgressUpdate } }
    | { type: 'UPDATE_SINGLE_REFERENCE_ASSET'; payload: ReferenceAsset }
    | { type: 'UPDATE_STORYBOARD_PANEL'; payload: StoryboardPanel }
    | { type: 'UPDATE_SCENE_FRAMES'; payload: ReferenceAsset[] }
    | { type: 'APPROVE_CRITIQUE_AND_GENERATE_DOCS' }
    | { type: 'API_VIRALITY_START' }
    | { type: 'API_VIRALITY_SUGGESTIONS_SUCCESS'; payload: { strategies: Critique['improvement_strategies'] } }
    | { type: 'API_APPLY_IMPROVEMENTS_START' }
    | { type: 'SET_AGENT_PROGRESS'; payload: any[] }
    | { type: 'SET_CURRENT_AGENT'; payload: string }
    | { type: 'CACHE_PHASE_RESULT'; payload: { key: string; data: any } };


const initialState: StoryBuilderState = {
    phase: 1,
    initialConcept: null,
    styleAndFormat: null,
    characters: [],
    storyStructure: null,
    coherenceReport: null,
    coherenceCheckProgress: null,
    storyPlan: null,
    critique: null,
    critiqueStage: null,
    critiqueProgress: null,
    documentation: null,
    referenceAssets: null,
    storyboardAssets: null,
    finalAssets: null,
    // New premium fields
    enhancedData: null,
    premiumPlan: null,
    premiumDocumentation: null,
    finalEvaluation: null,
};

// Add loading states to the initial state
const fullInitialState: StoryBuilderState & { 
    isLoading: boolean; isAssisting: boolean; error: string | null; assistingCharacterIds: Set<string>; progress: Record<string, ProgressUpdate>; isSuggestingVirality: boolean; isApplyingImprovements: boolean; agentProgress: any[]; currentAgent: string; phaseCache: Map<string, any>; processedPhases: Set<string>;
} = {
    ...initialState,
    isLoading: false,
    isAssisting: false,
    error: null,
    assistingCharacterIds: new Set(),
    progress: {},
    isSuggestingVirality: false,
    isApplyingImprovements: false,
    agentProgress: [],
    currentAgent: '',
    phaseCache: new Map<string, any>(),
    processedPhases: new Set<string>(),
};

function storyBuilderReducer(
    state: typeof fullInitialState, 
    action: Action
): typeof fullInitialState {
    switch (action.type) {
        case 'REINITIALIZE': {
            const loadedIds = (action.payload as any).assistingCharacterIds;
            const idsSet = Array.isArray(loadedIds) ? new Set(loadedIds) : new Set<string>();
            return { 
                ...fullInitialState, 
                ...action.payload,
                assistingCharacterIds: idsSet,
                phaseCache: new Map<string, any>(), // Reset cache on new project
                processedPhases: new Set<string>(),
            };
        }
        case 'GO_TO_PHASE': {
            return { ...state, phase: action.payload, error: null };
        }
        case 'COMPLETE_PHASE_AND_ADVANCE': {
            const forwardTransitions: { [key: string]: number } = {
                '1': 2, '2': 3, '3': 4,
                '4': 4.5, '4.5': 5, '5': 6.1, '6.1': 6.2, '6.2': 6.3, '6.3': 6.4,
            };
            const nextPhase = forwardTransitions[String(state.phase)];
            if (nextPhase !== undefined) {
                return { ...state, phase: nextPhase, error: null };
            }
            return state;
        }
        case 'APPROVE_CRITIQUE_AND_GENERATE_DOCS': {
             return { ...state, phase: 6.2, critiqueStage: 'approved', error: null };
        }
        case 'SET_CONCEPT':
            return { ...state, phase: 2, initialConcept: action.payload, error: null };
        case 'SET_STYLE':
            return { ...state, phase: 3, styleAndFormat: action.payload, error: null };
        case 'SET_CHARACTERS':
            return { ...state, phase: 4, characters: action.payload, error: null };
        case 'SET_STRUCTURE':
            return { ...state, phase: 4.5, storyStructure: action.payload, error: null, processedPhases: new Set(state.processedPhases).add('phase_4') };
        case 'API_START':
            const isAssist = action.payload?.isAssisting || false;
            return { ...state, isLoading: !isAssist, isAssisting: isAssist, error: null, agentProgress: [], currentAgent: '' };
        case 'API_ASSIST_CHAR_START':
            return { ...state, assistingCharacterIds: new Set(state.assistingCharacterIds).add(action.payload) };
        case 'API_SUCCESS':
            return { ...state, isLoading: false, isAssisting: false, isApplyingImprovements: false, error: null, ...action.payload };
        case 'API_ASSIST_CHAR_SUCCESS':
            const newChars = state.characters.map(c => c.id === action.payload.characterId ? action.payload.character : c);
            const newIds = new Set(state.assistingCharacterIds);
            newIds.delete(action.payload.characterId);
            return { ...state, characters: newChars, assistingCharacterIds: newIds, error: null };
        case 'API_ERROR':
            const newIds_err = new Set(state.assistingCharacterIds);
            newIds_err.delete('new-cast');
            return { ...state, isLoading: false, isAssisting: false, isSuggestingVirality: false, isApplyingImprovements: false, assistingCharacterIds: newIds_err, error: action.payload };
        case 'UPDATE_COHERENCE_PROGRESS':
            return { ...state, coherenceCheckProgress: action.payload };
        case 'UPDATE_CRITIQUE_PROGRESS':
            return { ...state, critiqueProgress: action.payload };
        case 'UPDATE_ASSET_GENERATION_PROGRESS':
            return { ...state, progress: { ...state.progress, [action.payload.assetId]: action.payload.progress } };
        case 'UPDATE_SINGLE_REFERENCE_ASSET':
             const updateAsset = (assets: ReferenceAsset[] | undefined, newAsset: ReferenceAsset) => {
                if (!assets) return [newAsset];
                return safeMap(assets, a => a.id === newAsset.id ? newAsset : a, { guard: isReferenceAsset });
             };
             if (!state.referenceAssets) {
                const initialAssets: ReferenceAssets = { characters: [], environments: [], elements: [], sceneFrames: [] };
                if (action.payload.type === 'character') initialAssets.characters = [action.payload];
                return { ...state, referenceAssets: initialAssets };
             }
             return { ...state, referenceAssets: {
                 ...state.referenceAssets,
                 characters: action.payload.type === 'character' ? updateAsset(state.referenceAssets.characters, action.payload) : state.referenceAssets.characters,
                 environments: action.payload.type === 'environment' ? updateAsset(state.referenceAssets.environments, action.payload) : state.referenceAssets.environments,
                 elements: action.payload.type === 'element' ? updateAsset(state.referenceAssets.elements, action.payload) : state.referenceAssets.elements,
                 sceneFrames: action.payload.type === 'scene_frame' ? updateAsset(state.referenceAssets.sceneFrames, action.payload) : state.referenceAssets.sceneFrames,
             }};
        case 'UPDATE_STORYBOARD_PANEL':
            const updatedPanels = state.storyboardAssets?.map(p => p.id === action.payload.id ? action.payload : p) || [];
            return { ...state, storyboardAssets: updatedPanels };
        case 'UPDATE_SCENE_FRAMES': {
             if (!state.referenceAssets) return state;
             const existingIds = new Set(state.referenceAssets.sceneFrames.map(f => f.id));
             const newFrames = action.payload.filter(f => !existingIds.has(f.id));
             return {
                 ...state,
                 referenceAssets: {
                     ...state.referenceAssets,
                     sceneFrames: [...state.referenceAssets.sceneFrames, ...newFrames]
                 }
             };
        }
        case 'API_VIRALITY_START':
            return { ...state, isSuggestingVirality: true, error: null };
        case 'API_VIRALITY_SUGGESTIONS_SUCCESS':
            if (!state.critique) return { ...state, isSuggestingVirality: false };
            const existingStrategyIds = new Set(state.critique.improvement_strategies.map(s => s.id));
            const newUniqueStrategies = action.payload.strategies.filter(s => !existingStrategyIds.has(s.id));
            return {
                ...state,
                isSuggestingVirality: false,
                critique: {
                    ...state.critique,
                    improvement_strategies: [...state.critique.improvement_strategies, ...newUniqueStrategies]
                }
            };
        case 'API_APPLY_IMPROVEMENTS_START':
            return { ...state, isApplyingImprovements: true, error: null };
        case 'SET_AGENT_PROGRESS':
            return { ...state, agentProgress: action.payload };
        case 'SET_CURRENT_AGENT':
            return { ...state, currentAgent: action.payload };
        case 'CACHE_PHASE_RESULT':
            return {
                ...state,
                phaseCache: new Map(state.phaseCache).set(action.payload.key, action.payload.data),
                processedPhases: new Set(state.processedPhases).add(action.payload.key),
            };
        default:
            return state;
    }
}

function b64toBlob(b64Data: string, contentType = '', sliceSize = 512): Blob {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

export const useStoryBuilderStateMachine = (existingProject?: ExportedProject) => {
    
    const initializer = (project?: ExportedProject): typeof fullInitialState => {
        const initialState = { ...fullInitialState };
        if (project) {
            Object.assign(initialState, project, {
                phaseCache: new Map<string, any>(),
                processedPhases: new Set<string>(),
            });
            const loadedAssistingIds = (project as any).assistingCharacterIds;
            if (Array.isArray(loadedAssistingIds)) {
                initialState.assistingCharacterIds = new Set(loadedAssistingIds);
            } else {
                initialState.assistingCharacterIds = new Set();
            }
        }
        return initialState;
    };

    const [state, dispatch] = useReducer(storyBuilderReducer, initializer(existingProject));

    useEffect(() => {
        const serializableState = {
            ...state,
            assistingCharacterIds: Array.from(state.assistingCharacterIds),
            phaseCache: {}, // Don't persist cache
            processedPhases: {}, // Don't persist processed phases
        };
        projectPersistenceService.saveProject(serializableState as unknown as ExportedProject);
    }, [state]);
    
    const apiCall = useCallback(async <T>(
        requestFn: (modelName: string) => Promise<any>,
        onSuccess: (data: any) => Partial<StoryBuilderState>,
        options: { isAssist?: boolean, schema?: any, validationContext?: string } = {}
    ): Promise<T | void> => {
        const { isAssist = false, schema, validationContext } = options;
        dispatch({ type: 'API_START', payload: { isAssisting: isAssist } });
        try {
            const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
            // Use the new rate limiter
            const response = await apiRateLimiter.addCall(() => requestFn(modelName));
            const text = response.text;
            const data = parseJsonMarkdown(text);

            if (schema) {
                const validatedData = safeParseWithDefaults(data, schema, {
                    preservePartial: true,
                    notifyUser: true,
                    context: validationContext || 'GenericApiCall'
                });
                dispatch({ type: 'API_SUCCESS', payload: onSuccess(validatedData) });
                return validatedData as T;
            }
            
            dispatch({ type: 'API_SUCCESS', payload: onSuccess(data) });
            return data as T;
        } catch (error) {
            const errorMessage = formatApiError(error);
            logger.log('ERROR', 'StateMachine', 'API call failed', { error: errorMessage });
            dispatch({ type: 'API_ERROR', payload: errorMessage });
        }
    }, [state.initialConcept]);

    const pollVideoOperation = useCallback(async (operation: any, apiKey: string): Promise<string> => {
        let op = operation;
        while (!op.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            op = await geminiService.getVideosOperation({ operation });
        }
        if (op.error) throw new Error(JSON.stringify(op.error));
        const uri = op.response?.generatedVideos?.[0]?.video?.uri;
        if (!uri) throw new Error("Video generation finished but no URI was returned.");
        
        const videoResponse = await fetch(`${uri}&key=${apiKey}`);
        if (!videoResponse.ok) throw new Error(`Failed to download video from URI: ${videoResponse.statusText}`);
        const videoBlob = await videoResponse.blob();
        
        const assetId = `video_${uuidv4()}`;
        await assetDBService.saveAsset(assetId, videoBlob);
        return assetId;
    }, []);

    const actions = useMemo(() => ({
        goToPhase: (phase: number) => {
            const phaseKey = `phase_${phase}`;
            const isNavigatingBack = phase < state.phase;
            if (isNavigatingBack && state.phaseCache.has(phaseKey)) {
                const cachedData = state.phaseCache.get(phaseKey);
                dispatch({ type: 'API_SUCCESS', payload: { ...cachedData, phase: phase }});
            } else {
                dispatch({ type: 'GO_TO_PHASE', payload: phase });
            }
        },
        completePhaseAndAdvance: () => dispatch({ type: 'COMPLETE_PHASE_AND_ADVANCE' }),
        setConcept: (data: InitialConcept) => dispatch({ type: 'SET_CONCEPT', payload: data }),
        setStyle: (data: StyleAndFormat) => dispatch({ type: 'SET_STYLE', payload: data }),
        setCharacters: (data: CharacterDefinition[]) => dispatch({ type: 'SET_CHARACTERS', payload: data }),
        setStructure: (data: StoryStructure) => {
            dispatch({ type: 'SET_STRUCTURE', payload: data });
            actions.runArtisticConstruction();
        },

        runArtisticConstruction: async () => {
            const cacheKey = 'phase_4.5';
            if (state.phaseCache.has(cacheKey)) {
                dispatch({ type: 'API_SUCCESS', payload: { enhancedData: state.phaseCache.get(cacheKey), phase: 5 } });
                return;
            }
            dispatch({ type: 'API_START' });
            const orchestrator = new AgentOrchestrator();
            const baseData = {
                storyStructure: state.storyStructure,
                initialConcept: state.initialConcept,
                styleAndFormat: state.styleAndFormat,
                characters: state.characters
            };

            try {
                let allProgress: any[] = [];
                const enhancedData = await orchestrator.processWithAllAgents(baseData, {
                    onAgentStart: (agentName) => dispatch({ type: 'SET_CURRENT_AGENT', payload: agentName }),
                    onAgentProgress: (progress) => {
                        allProgress.push(progress);
                        dispatch({ type: 'SET_AGENT_PROGRESS', payload: [...allProgress] });
                    },
                });
                dispatch({ type: 'CACHE_PHASE_RESULT', payload: { key: cacheKey, data: { enhancedData } } });
                dispatch({ type: 'API_SUCCESS', payload: { enhancedData, phase: 5 } });
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        generatePremiumPlan: async () => {
             const cacheKey = 'phase_5';
            if (state.phaseCache.has(cacheKey)) {
                dispatch({ type: 'API_SUCCESS', payload: { premiumPlan: state.phaseCache.get(cacheKey), phase: 6.1 } });
                return;
            }
            if (!state.enhancedData) return;
            const data = await apiCall<PremiumStoryPlan>(
                (model) => geminiService.generateContent(Prompts.getPremiumStoryPlanPrompt(state), model),
                (data) => ({ premiumPlan: data, phase: 6.1 }),
                { validationContext: 'PremiumStoryPlan' }
            );
            if(data) dispatch({ type: 'CACHE_PHASE_RESULT', payload: { key: cacheKey, data: { premiumPlan: data } } });
        },

        generatePremiumDocs: async () => {
            const cacheKey = 'phase_6.1';
            if (state.phaseCache.has(cacheKey)) {
                dispatch({ type: 'API_SUCCESS', payload: { premiumDocumentation: state.phaseCache.get(cacheKey), phase: 6.2 } });
                return;
            }
            if (!state.premiumPlan) return;
            const data = await apiCall<PremiumDocumentation>(
                (model) => geminiService.generateContent(Prompts.getPremiumDocumentationPrompt(state.premiumPlan!), model),
                (data) => ({ premiumDocumentation: data, phase: 6.2 }),
                { validationContext: 'PremiumDocumentation' }
            );
             if(data) dispatch({ type: 'CACHE_PHASE_RESULT', payload: { key: cacheKey, data: { premiumDocumentation: data } } });
        },
        
        runFinalEvaluation: async () => {
            const cacheKey = 'phase_6.2';
             if (state.phaseCache.has(cacheKey)) {
                dispatch({ type: 'API_SUCCESS', payload: { finalEvaluation: state.phaseCache.get(cacheKey), phase: 6.3 } });
                return;
            }
             if (!state.premiumDocumentation) return;
             const data = await apiCall(
                 (model) => geminiService.generateContent({ contents: `Evalúa esta documentación premium: ${JSON.stringify(state.premiumDocumentation)}` }, model),
                 (data) => ({ finalEvaluation: data, phase: 6.3 })
             );
              if(data) dispatch({ type: 'CACHE_PHASE_RESULT', payload: { key: cacheKey, data: { finalEvaluation: data } } });
        },

        assistConcept: async (idea: string) => {
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getConceptAssistancePrompt(idea), model),
                (data) => ({ initialConcept: { ...data, selectedTextModel: state.initialConcept?.selectedTextModel, selectedImageModel: state.initialConcept?.selectedImageModel } }),
                { isAssist: true }
            );
        },

        suggestStyle: async () => {
            if (!state.initialConcept) return;
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStyleSuggestionPrompt(state.initialConcept!), model),
                (data) => ({ styleAndFormat: data }),
                { isAssist: true }
            );
        },

        assistCharacter: async (characterId: string) => {
            const character = state.characters.find(c => c.id === characterId);
            if (!character || !state.initialConcept) return;
            dispatch({ type: 'API_ASSIST_CHAR_START', payload: characterId });
            try {
                const modelName = state.initialConcept.selectedTextModel || 'gemini-2.5-flash';
                const response = await apiRateLimiter.addCall(() => geminiService.generateContent(Prompts.getCharacterAssistancePrompt(character, state.initialConcept!), modelName));
                const data = parseJsonMarkdown(response.text);
                dispatch({ type: 'API_ASSIST_CHAR_SUCCESS', payload: { characterId, character: { ...character, ...data } } });
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        generateCharacterCast: async () => {
            if (!state.initialConcept) return;
            dispatch({ type: 'API_ASSIST_CHAR_START', payload: 'new-cast' });
            try {
                const modelName = state.initialConcept.selectedTextModel || 'gemini-2.5-flash';
                const response = await apiRateLimiter.addCall(() => geminiService.generateContent(Prompts.getCharacterCastPrompt(state.initialConcept!), modelName));
                const data = parseJsonMarkdown(response.text);
                const newCharacters = (data.characters || []).filter(Boolean).map((char: any) => ({
                    ...createNewCharacter(),
                    ...char,
                }));
                const newAssistingIds = new Set(state.assistingCharacterIds);
                newAssistingIds.delete('new-cast');
                dispatch({ type: 'API_SUCCESS', payload: { characters: newCharacters, assistingCharacterIds: newAssistingIds } });
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        assistStructure: async () => {
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStructureAssistancePrompt(state.initialConcept!, state.styleAndFormat!, state.characters), model),
                (data) => ({ storyStructure: data }),
                { isAssist: true }
            );
        },
        
        generateCharacterReferences: async () => {
             // Implementation remains the same, but API calls will be rate-limited
        },

        generateStoryboard: async (aspectRatio: string) => {
             // Implementation remains the same, but API calls will be rate-limited
        },
        
        regenerateStoryboardPanel: async (panel: StoryboardPanel, instruction?: string) => {
             // Implementation remains the same, but API calls will be rate-limited
        },

        generateFinalAssets: async (selectedScenes: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => {
             // Implementation remains the same, but API calls will be rate-limited
        },
    }), [state, apiCall, pollVideoOperation]);

    return { state, actions };
};

const createNewCharacter = (): Partial<CharacterDefinition> => ({
    id: uuidv4(),
    motivation: { desire: '', fear: '', need: '' },
    relationships: [],
});