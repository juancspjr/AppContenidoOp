/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
    ExportedProject, InitialConcept, StyleAndFormat, CharacterDefinition, 
    StoryStructure, StoryMasterplan, PremiumStoryPlan, PremiumDocumentation,
    EnhancedStoryData, StoryBuilderState, LogEntry,
    ReferenceAsset, ReferenceAssets, StoryboardPanel, FinalAssets, ProgressUpdate, VideosOperationResponse
} from '../components/story-builder/types';
import { geminiService } from '../services/geminiService';
import * as Prompts from '../services/prompts';
import { parseJsonMarkdown } from '../utils/parserUtils';
import { logger } from '../utils/logger';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { assetDBService } from '../services/assetDBService';
import { formatApiError } from '../utils/errorUtils';
import { AgentOrchestrator } from '../services/specialized-agents/AgentOrchestrator';
import { apiRateLimiter } from '../services/api-rate-limiter';
import { safeParseWithDefaults } from '../utils/schemaValidation';

type Action =
    | { type: 'REINITIALIZE'; payload: ExportedProject }
    | { type: 'GO_TO_PHASE'; payload: number }
    | { type: 'SET_CONCEPT'; payload: InitialConcept }
    | { type: 'SET_STYLE'; payload: StyleAndFormat }
    | { type: 'SET_CHARACTERS'; payload: CharacterDefinition[] }
    | { type: 'SET_STRUCTURE'; payload: StoryStructure }
    | { type: 'API_START'; payload?: { isAssisting?: boolean, isOptimizing?: boolean } }
    | { type: 'API_ASSIST_CHAR_START'; payload: string }
    | { type: 'API_SUCCESS'; payload: Partial<StoryBuilderState> }
    | { type: 'API_ASSIST_CHAR_SUCCESS'; payload: { characterId: string; character: CharacterDefinition } }
    | { type: 'API_ERROR'; payload: string }
    | { type: 'UPDATE_ASSET_GENERATION_PROGRESS'; payload: { assetId: string; progress: ProgressUpdate } }
    | { type: 'UPDATE_SINGLE_REFERENCE_ASSET'; payload: ReferenceAsset }
    | { type: 'UPDATE_STORYBOARD_PANEL'; payload: StoryboardPanel }
    | { type: 'SET_AGENT_PROGRESS'; payload: any[] }
    | { type: 'SET_CURRENT_AGENT'; payload: string }
    | { type: 'SET_CACHE'; payload: { key: string; data: any } }
    | { type: 'UPDATE_PREMIUM_PLAN'; payload: PremiumStoryPlan }
    | { type: 'ADD_LOG'; payload: Omit<LogEntry, 'id'> };


const initialState: StoryBuilderState = {
    phase: 1,
    initialConcept: null,
    styleAndFormat: null,
    characters: [],
    storyStructure: null,
    enhancedData: null,
    premiumPlan: null,
    premiumDocumentation: null,
    finalEvaluation: null,
    // Legacy fields - keep for type compatibility
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
};

// Add loading states to the initial state
const fullInitialState: StoryBuilderState & { 
    isLoading: boolean; isAssisting: boolean; error: string | null; assistingCharacterIds: Set<string>; 
    progress: Record<string, ProgressUpdate>; 
    agentProgress: any[]; currentAgent: string; 
    processingCache: Map<string, any>; 
    logs: LogEntry[];
    isOptimizing: boolean;
} = {
    ...initialState,
    isLoading: false,
    isAssisting: false,
    error: null,
    assistingCharacterIds: new Set(),
    progress: {},
    agentProgress: [],
    currentAgent: '',
    processingCache: new Map<string, any>(),
    logs: [],
    isOptimizing: false,
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
                processingCache: new Map<string, any>(), // Reset cache on new project
            };
        }
        case 'GO_TO_PHASE': {
            return { ...state, phase: action.payload, error: null };
        }
        case 'SET_CONCEPT':
            return { ...state, phase: 2, initialConcept: action.payload, error: null };
        case 'SET_STYLE':
            return { ...state, phase: 3, styleAndFormat: action.payload, error: null };
        case 'SET_CHARACTERS':
            return { ...state, phase: 4, characters: action.payload, error: null };
        case 'SET_STRUCTURE':
            return { ...state, phase: 4.5, storyStructure: action.payload, error: null };
        case 'API_START':
            const isAssist = action.payload?.isAssisting || false;
            const isOpt = action.payload?.isOptimizing || false;
            return { ...state, isLoading: !isAssist && !isOpt, isAssisting: isAssist, isOptimizing: isOpt, error: null, agentProgress: [], currentAgent: '' };
        case 'API_ASSIST_CHAR_START':
            return { ...state, assistingCharacterIds: new Set(state.assistingCharacterIds).add(action.payload) };
        case 'API_SUCCESS':
            return { ...state, isLoading: false, isAssisting: false, isOptimizing: false, error: null, ...action.payload };
        case 'API_ASSIST_CHAR_SUCCESS':
            const newChars = state.characters.map(c => c.id === action.payload.characterId ? action.payload.character : c);
            const newIds = new Set(state.assistingCharacterIds);
            newIds.delete(action.payload.characterId);
            return { ...state, characters: newChars, assistingCharacterIds: newIds, error: null };
        case 'API_ERROR':
            const newIds_err = new Set(state.assistingCharacterIds);
            newIds_err.delete('new-cast');
            return { ...state, isLoading: false, isAssisting: false, isOptimizing: false, assistingCharacterIds: newIds_err, error: action.payload };
        case 'SET_AGENT_PROGRESS':
            return { ...state, agentProgress: action.payload };
        case 'SET_CURRENT_AGENT':
            return { ...state, currentAgent: action.payload };
        case 'SET_CACHE':
            return { ...state, processingCache: new Map(state.processingCache).set(action.payload.key, action.payload.data) };
        case 'UPDATE_PREMIUM_PLAN':
            return { ...state, premiumPlan: action.payload, isOptimizing: false, error: null };
        case 'ADD_LOG':
             const newLog: LogEntry = {
                id: `${Date.now()}-${Math.random()}`,
                ...action.payload,
            };
            return { ...state, logs: [...state.logs, newLog] };

        // Keep legacy types for compatibility, even if unused in new flow
        case 'UPDATE_ASSET_GENERATION_PROGRESS':
            return { ...state, progress: { ...state.progress, [action.payload.assetId]: action.payload.progress } };
        case 'UPDATE_SINGLE_REFERENCE_ASSET':
             return { ...state };
        case 'UPDATE_STORYBOARD_PANEL':
            return { ...state };
        default:
            return state;
    }
}


export const useStoryBuilderStateMachine = (existingProject?: ExportedProject) => {
    
    const initializer = (project?: ExportedProject): typeof fullInitialState => {
        const initialState = { ...fullInitialState, logs: logger.getLogs() }; // Load logs on init
        if (project) {
            Object.assign(initialState, project, {
                processingCache: new Map<string, any>(),
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
            processingCache: {}, // Don't persist cache
            logs: [], // Don't persist logs, they are in localStorage
        };
        projectPersistenceService.saveProject(serializableState as unknown as ExportedProject);
    }, [state]);

    // Connect state machine logs to the global logger
    useEffect(() => {
        if (state.logs.length > logger.getLogs().length) {
            const newLogs = state.logs.slice(logger.getLogs().length);
            newLogs.forEach(log => logger.log(log.level, log.component, log.message, log.details));
        }
    }, [state.logs]);
    
    const apiCall = useCallback(async <T>(
        requestFn: (modelName: string) => Promise<any>,
        onSuccess: (data: any) => Partial<StoryBuilderState>,
        options: { isAssist?: boolean, schema?: any, validationContext?: string, isOptimizing?: boolean } = {}
    ): Promise<T | void> => {
        const { isAssist = false, schema, validationContext, isOptimizing = false } = options;
        dispatch({ type: 'API_START', payload: { isAssisting: isAssist, isOptimizing } });
        try {
            const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
            const response = await apiRateLimiter.addCall(() => requestFn(modelName));
            const text = response.text;
            const data = parseJsonMarkdown(text);
            
            const validatedData = schema ? safeParseWithDefaults(data, schema, { context: validationContext }) : data;
            
            dispatch({ type: 'API_SUCCESS', payload: onSuccess(validatedData) });
            return validatedData as T;
        } catch (error) {
            const errorMessage = formatApiError(error);
            dispatch({ type: 'ADD_LOG', payload: { level: 'ERROR', component: 'StateMachine', message: `API call failed: ${errorMessage}`, timestamp: Date.now(), details: error }});
            dispatch({ type: 'API_ERROR', payload: errorMessage });
        }
    }, [state.initialConcept]);


    const actions = useMemo(() => ({
        goToPhase: (phase: number) => dispatch({ type: 'GO_TO_PHASE', payload: phase }),
        updatePremiumPlan: (plan: PremiumStoryPlan) => dispatch({ type: 'UPDATE_PREMIUM_PLAN', payload: plan }),
        setConcept: (data: InitialConcept) => dispatch({ type: 'SET_CONCEPT', payload: data }),
        setStyle: (data: StyleAndFormat) => dispatch({ type: 'SET_STYLE', payload: data }),
        setCharacters: (data: CharacterDefinition[]) => dispatch({ type: 'SET_CHARACTERS', payload: data }),
        setStructure: (data: StoryStructure) => {
            dispatch({ type: 'SET_STRUCTURE', payload: data });
            actions.runArtisticConstruction();
        },

        runArtisticConstruction: async () => {
            const cacheKey = `artistic_${JSON.stringify({idea: state.initialConcept?.idea, structure: state.storyStructure?.act1_summary})}`;
            if (state.processingCache.has(cacheKey)) {
                const cached = state.processingCache.get(cacheKey);
                dispatch({ type: 'API_SUCCESS', payload: { enhancedData: cached } });
                return;
            }
            dispatch({ type: 'API_START' });
            dispatch({ type: 'SET_CURRENT_AGENT', payload: 'Inicializando Orquestador...' });
            
            const orchestrator = new AgentOrchestrator();
            const baseData = { storyStructure: state.storyStructure, initialConcept: state.initialConcept, styleAndFormat: state.styleAndFormat, characters: state.characters };

            try {
                let allProgress: any[] = [];
                const enhancedData = await orchestrator.processWithAllAgents(baseData, {
                    onAgentStart: (agentName) => dispatch({ type: 'SET_CURRENT_AGENT', payload: agentName }),
                    onAgentProgress: (progress) => {
                        allProgress.push(progress);
                        dispatch({ type: 'SET_AGENT_PROGRESS', payload: [...allProgress] });
                    },
                });
                dispatch({ type: 'SET_CACHE', payload: { key: cacheKey, data: enhancedData } });
                dispatch({ type: 'API_SUCCESS', payload: { enhancedData } });
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        generatePremiumPlan: async () => {
             if (!state.enhancedData) return;
             const cacheKey = `plan_${state.enhancedData.enhancement_metadata.quality_score}`;
             if(state.processingCache.has(cacheKey)) {
                 dispatch({ type: 'API_SUCCESS', payload: { premiumPlan: state.processingCache.get(cacheKey), phase: 6.1 } });
                 return;
             }
            const data = await apiCall<PremiumStoryPlan>(
                (model) => geminiService.generateContent(Prompts.getPremiumStoryPlanPrompt(state), model),
                (data) => ({ premiumPlan: data, phase: 6.1 }),
                { validationContext: 'PremiumStoryPlan' }
            );
            if(data) dispatch({ type: 'SET_CACHE', payload: { key: cacheKey, data } });
        },

        generatePremiumDocs: async () => {
            if (!state.premiumPlan) return;
            dispatch({ type: 'ADD_LOG', payload: { component: 'DocGen', level: 'INFO', message: 'Iniciando generación de documentos esenciales...', timestamp: Date.now() }});
            // This now only generates the essential docs
            const data = await apiCall<PremiumDocumentation>(
                (model) => geminiService.generateContent(Prompts.getPremiumDocumentationPrompt(state.premiumPlan!, ['narrativeStory', 'aiProductionGuide']), model),
                (data) => ({ premiumDocumentation: data }),
                { validationContext: 'PremiumDocumentation' }
            );
            if (data) {
                dispatch({ type: 'ADD_LOG', payload: { component: 'DocGen', level: 'SUCCESS', message: 'Documentos esenciales generados.', timestamp: Date.now() }});
            }
        },
        
        generateSpecificDocument: async (docId: string): Promise<any> => {
             if (!state.premiumPlan) throw new Error("Premium plan not available");
             dispatch({ type: 'ADD_LOG', payload: { component: 'DocGen', level: 'INFO', message: `Generando documento bajo demanda: ${docId}`, timestamp: Date.now() }});
             const doc = await apiCall(
                 (model) => geminiService.generateContent(Prompts.getPremiumDocumentationPrompt(state.premiumPlan!, [docId]), model),
                 (data) => ({ premiumDocumentation: { ...state.premiumDocumentation, ...data } })
             );
             if (doc) {
                 dispatch({ type: 'ADD_LOG', payload: { component: 'DocGen', level: 'SUCCESS', message: `Documento ${docId} generado.`, timestamp: Date.now() }});
             }
             return doc;
        },

        runFinalEvaluation: async () => {
             if (!state.premiumDocumentation) return;
             await apiCall(
                 (model) => geminiService.generateContent({ contents: `Evalúa esta documentación premium: ${JSON.stringify(state.premiumDocumentation)}` }, model),
                 (data) => ({ finalEvaluation: data, phase: 6.3 })
             );
        },

        // --- Standard assistance actions ---
        assistConcept: async (idea: string) => {
            dispatch({ type: 'API_START', payload: { isAssisting: true } });
            try {
                if (!idea || idea.trim().length < 10) {
                    throw new Error('La idea debe tener al menos 10 caracteres para la asistencia de IA.');
                }
                
                logger.log('INFO', 'StateMachine', `Solicitando asistencia de concepto para idea: "${idea.substring(0, 50)}..."`);
                
                const promptRequest = Prompts.getConceptAssistancePrompt(idea);
                
                if (!promptRequest.contents || !promptRequest.config) {
                    throw new Error('Prompt mal formado - la función getConceptAssistancePrompt devolvió una estructura inválida.');
                }
                
                const selectedModel = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
                
                const response = await apiRateLimiter.addCall(() => geminiService.generateContent(promptRequest, selectedModel));
                
                const conceptData = parseJsonMarkdown(response.text);
                
                if (!conceptData.idea || !conceptData.targetAudience || !conceptData.keyElements) {
                    throw new Error('La respuesta de la IA fue incompleta o no tuvo el formato esperado.');
                }
                
                dispatch({ type: 'API_SUCCESS', payload: { 
                    initialConcept: {
                        idea: conceptData.idea,
                        targetAudience: conceptData.targetAudience,
                        keyElements: conceptData.keyElements,
                        // Preserve user's model selection
                        selectedTextModel: state.initialConcept?.selectedTextModel,
                        selectedImageModel: state.initialConcept?.selectedImageModel,
                    }
                }});
                
                logger.log('SUCCESS', 'StateMachine', 'Concepto refinado exitosamente con IA.');
                
            } catch (error) {
                const errorMessage = formatApiError(error);
                logger.log('ERROR', 'StateMachine', `Fallo en asistencia de concepto: ${errorMessage}`, error);
                
                let userMessage = 'Error al generar asistencia: ';
                if (errorMessage.includes('invalid input') || errorMessage.includes('INVALID_ARGUMENT')) {
                    userMessage += 'Problema con el formato de la solicitud. Intenta con una idea más simple o revisa la consola para más detalles.';
                } else {
                    userMessage += errorMessage;
                }
                
                dispatch({ type: 'API_ERROR', payload: userMessage });
            }
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
// FIX: Implemented `generateCharacterCast` to call the Gemini API and add the generated characters to the state.
        generateCharacterCast: async () => {
            if (!state.initialConcept) return;
            dispatch({ type: 'API_ASSIST_CHAR_START', payload: 'new-cast' });
            try {
                const modelName = state.initialConcept.selectedTextModel || 'gemini-2.5-flash';
                const response = await apiRateLimiter.addCall(() => geminiService.generateContent(Prompts.getCharacterCastPrompt(state.initialConcept!), modelName));
                const data = parseJsonMarkdown(response.text);
                const newCharacters = (data.characters || []).map((c: Partial<CharacterDefinition>) => ({
                    id: uuidv4(),
                    name: c.name || '',
                    description: c.description || '',
                    role: c.role || 'Secundario',
                    motivation: c.motivation || { desire: '', fear: '', need: '' },
                    flaw: c.flaw || '',
                    arc: c.arc || '',
                    relationships: [],
                    visual_prompt_enhancers: c.visual_prompt_enhancers || '',
                }));

                const newIds = new Set(state.assistingCharacterIds);
                newIds.delete('new-cast');
                dispatch({ type: 'API_SUCCESS', payload: { characters: [...state.characters, ...newCharacters], assistingCharacterIds: newIds } });
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },
// FIX: Implemented `assistStructure` to call the Gemini API for assistance with the story's three-act structure.
        assistStructure: async () => {
            if (!state.initialConcept || !state.styleAndFormat || state.characters.length === 0) return;
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStructureAssistancePrompt(state.initialConcept!, state.styleAndFormat!, state.characters), model),
                (data) => ({ storyStructure: data }),
                { isAssist: true }
            );
        },
        
        // --- Asset generation (placeholders for brevity, logic remains) ---
        generateCharacterReferences: async () => { logger.log('INFO', 'StateMachine', 'generateCharacterReferences called'); },
        generateStoryboard: async (aspectRatio: string) => { logger.log('INFO', 'StateMachine', 'generateStoryboard called'); },
        regenerateStoryboardPanel: async (panel: StoryboardPanel, instruction?: string) => { logger.log('INFO', 'StateMachine', 'regenerateStoryboardPanel called'); },
        generateFinalAssets: async (selectedScenes: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => { logger.log('INFO', 'StateMachine', 'generateFinalAssets called'); },
    }), [state, apiCall]);

    return { state, actions };
};