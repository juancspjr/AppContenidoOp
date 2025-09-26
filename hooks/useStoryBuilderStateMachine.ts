/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useReducer, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
    StoryBuilderState,
    ExportedProject,
    InitialConcept,
    StyleAndFormat,
    CharacterDefinition,
    StoryStructure,
    StoryboardPanel,
    ReferenceAsset,
    PremiumDocumentation,
    EnhancedStoryData,
    PremiumStoryPlan,
} from '../components/story-builder/types';
import {
    getConceptAssistancePrompt,
    getStyleSuggestionPrompt,
    getCharacterAssistancePrompt,
    getCharacterCastPrompt,
    getStructureAssistancePrompt,
    getPremiumStoryPlanPrompt,
    getPremiumDocumentationPrompt
} from '../services/prompts';
import { geminiService } from '../services/geminiService';
import { parseJsonMarkdown } from '../utils/parserUtils';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { logger } from '../utils/logger';
import { AgentOrchestrator } from '../services/specialized-agents/AgentOrchestrator';
import { fileToGenerativePart } from '../utils/fileUtils';
import { sliceImageIntoGrid } from '../utils/imageUtils';
import { assetDBService } from '../services/assetDBService';

type Action =
    | { type: 'SET_STATE'; payload: Partial<StoryBuilderState> }
    | { type: 'GO_TO_PHASE'; payload: number }
    | { type: 'SET_CONCEPT'; payload: InitialConcept }
    | { type: 'SET_STYLE'; payload: StyleAndFormat }
    | { type: 'SET_CHARACTERS'; payload: CharacterDefinition[] }
    | { type: 'UPDATE_CHARACTER'; payload: CharacterDefinition }
    | { type: 'SET_STRUCTURE'; payload: StoryStructure }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ASSISTING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'START_ASSIST_CHARACTER'; payload: string }
    | { type: 'END_ASSIST_CHARACTER'; payload: string }
    | { type: 'SET_ENHANCED_DATA', payload: EnhancedStoryData | null }
    | { type: 'SET_PREMIUM_PLAN', payload: PremiumStoryPlan | null }
    | { type: 'SET_PREMIUM_DOCS', payload: PremiumDocumentation | null }
    | { type: 'SET_FINAL_EVALUATION', payload: any | null }
    | { type: 'SET_AGENT_PROGRESS', payload: { agent: string, progress: any[] } }
    | { type: 'SET_STORYBOARD_ASSETS', payload: StoryboardPanel[] }
    | { type: 'UPDATE_STORYBOARD_PANEL', payload: StoryboardPanel }
    | { type: 'SET_FINAL_ASSETS', payload: StoryBuilderState['finalAssets'] }
    | { type: 'SET_PROGRESS', payload: { key: string, update: any } }
    | { type: 'SET_REFERENCE_ASSETS', payload: StoryBuilderState['referenceAssets'] }
    | { type: 'UPDATE_REFERENCE_ASSET', payload: ReferenceAsset };


const initialState: StoryBuilderState = {
    phase: 1,
    initialConcept: null,
    styleAndFormat: null,
    characters: [],
    storyStructure: null,
    coherenceReport: null,
    coherenceCheckProgress: [],
    storyPlan: null,
    critique: null,
    critiqueStage: null,
    critiqueProgress: [],
    documentation: null,
    referenceAssets: null,
    storyboardAssets: null,
    finalAssets: null,
    // Custom state machine fields
    isLoading: false,
    isAssisting: false,
    assistingCharacterIds: new Set(),
    error: null,
    progress: {},
    enhancedData: null,
    premiumPlan: null,
    premiumDocumentation: null,
    finalEvaluation: null,
    currentAgent: '',
    agentProgress: [],
};

function reducer(state: StoryBuilderState, action: Action): StoryBuilderState {
    switch (action.type) {
        case 'SET_STATE':
            return { ...state, ...action.payload };
        case 'GO_TO_PHASE':
            return { ...state, phase: action.payload, error: null };
        case 'SET_CONCEPT':
            return { ...state, initialConcept: action.payload, phase: 2 };
        case 'SET_STYLE':
            return { ...state, styleAndFormat: action.payload, phase: 3 };
        case 'SET_CHARACTERS':
            return { ...state, characters: action.payload, phase: 4 };
        case 'UPDATE_CHARACTER':
            return {
                ...state,
                characters: state.characters.map(c => c.id === action.payload.id ? action.payload : c),
            };
        case 'SET_STRUCTURE':
            return { ...state, storyStructure: action.payload, phase: 4.5 };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload, error: null };
        case 'SET_ASSISTING':
            return { ...state, isAssisting: action.payload, error: null };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false, isAssisting: false };
        case 'START_ASSIST_CHARACTER':
            return { ...state, assistingCharacterIds: new Set(state.assistingCharacterIds).add(action.payload) };
        case 'END_ASSIST_CHARACTER': {
            const newSet = new Set(state.assistingCharacterIds);
            newSet.delete(action.payload);
            return { ...state, assistingCharacterIds: newSet };
        }
        case 'SET_ENHANCED_DATA':
            return { ...state, enhancedData: action.payload, isLoading: false, phase: 5 };
        case 'SET_PREMIUM_PLAN':
            return { ...state, premiumPlan: action.payload, isLoading: false, phase: 6.1 };
        case 'SET_PREMIUM_DOCS':
             return { ...state, premiumDocumentation: action.payload, isLoading: false, phase: 6.2 };
        case 'SET_FINAL_EVALUATION':
             return { ...state, finalEvaluation: action.payload, isLoading: false, phase: 6.3 };
        case 'SET_AGENT_PROGRESS':
             return { ...state, currentAgent: action.payload.agent, agentProgress: action.payload.progress };
        case 'SET_REFERENCE_ASSETS':
             return { ...state, referenceAssets: action.payload };
        case 'UPDATE_REFERENCE_ASSET':
             const updatedAssets = state.referenceAssets ? { ...state.referenceAssets } : { characters: [], environments: [], elements: [], sceneFrames: [] };
             if (updatedAssets.characters) {
                 updatedAssets.characters = updatedAssets.characters.map(a => a.id === action.payload.id ? action.payload : a);
             }
             return { ...state, referenceAssets: updatedAssets };
        case 'SET_STORYBOARD_ASSETS':
             return { ...state, storyboardAssets: action.payload };
        case 'UPDATE_STORYBOARD_PANEL':
             return {
                 ...state,
                 storyboardAssets: (state.storyboardAssets || []).map(p => p.id === action.payload.id ? action.payload : p),
             };
        case 'SET_FINAL_ASSETS':
            return { ...state, finalAssets: action.payload };
        case 'SET_PROGRESS':
            return { ...state, progress: { ...state.progress, [action.payload.key]: action.payload.update } };
        default:
            return state;
    }
}

// Helper to run API calls with consistent state management
async function runApiCall<T>(
    dispatch: React.Dispatch<Action>,
    apiCall: () => Promise<T>,
    loadingType: 'SET_LOADING' | 'SET_ASSISTING' = 'SET_LOADING'
): Promise<T | null> {
    dispatch({ type: loadingType, payload: true });
    try {
        const result = await apiCall();
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.log('ERROR', 'StateMachine', `API Call failed: ${errorMessage}`, error);
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return null;
    } finally {
        dispatch({ type: loadingType, payload: false });
    }
}

export function useStoryBuilderStateMachine(existingProject?: ExportedProject) {
    const [state, dispatch] = useReducer(reducer, existingProject ? { ...initialState, ...existingProject } : initialState);

    // Save project to local storage on every state change
    useEffect(() => {
        projectPersistenceService.saveProject(state);
    }, [state]);

    // --- ACTIONS ---
    const goToPhase = useCallback((phase: number) => {
        dispatch({ type: 'GO_TO_PHASE', payload: phase });
    }, []);

    const setConcept = useCallback((data: InitialConcept) => {
        dispatch({ type: 'SET_CONCEPT', payload: data });
    }, []);

    const assistConcept = useCallback(async (idea: string) => {
        const result = await runApiCall(dispatch, async () => {
            const prompt = getConceptAssistancePrompt(idea);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text) as InitialConcept;
        }, 'SET_ASSISTING');
        if (result) {
            dispatch({ type: 'SET_STATE', payload: { initialConcept: result } });
        }
    }, [dispatch]);
    
    const setStyle = useCallback((data: StyleAndFormat) => {
        dispatch({ type: 'SET_STYLE', payload: data });
    }, []);

    const suggestStyle = useCallback(async () => {
        if (!state.initialConcept) return;
        const result = await runApiCall(dispatch, async () => {
            const prompt = getStyleSuggestionPrompt(state.initialConcept!);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text) as StyleAndFormat;
        }, 'SET_ASSISTING');
        if (result) {
            dispatch({ type: 'SET_STATE', payload: { styleAndFormat: result } });
        }
    }, [dispatch, state.initialConcept]);

    const setCharacters = useCallback((data: CharacterDefinition[]) => {
        dispatch({ type: 'SET_CHARACTERS', payload: data });
    }, []);

     const assistCharacter = useCallback(async (characterId: string) => {
        if (!state.initialConcept) return;
        const character = state.characters.find(c => c.id === characterId);
        if (!character) return;

        dispatch({ type: 'START_ASSIST_CHARACTER', payload: characterId });
        const result = await runApiCall(dispatch, async () => {
            const prompt = getCharacterAssistancePrompt(character, state.initialConcept!);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text);
        });
        if (result) {
            dispatch({ type: 'UPDATE_CHARACTER', payload: { ...character, ...result } });
        }
        dispatch({ type: 'END_ASSIST_CHARACTER', payload: characterId });
    }, [dispatch, state.initialConcept, state.characters]);

    const generateCharacterCast = useCallback(async () => {
        if (!state.initialConcept) return;
        dispatch({ type: 'START_ASSIST_CHARACTER', payload: 'new-cast' });
        const result = await runApiCall(dispatch, async () => {
            const prompt = getCharacterCastPrompt(state.initialConcept!);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text).characters as Omit<CharacterDefinition, 'id'>[];
        });
        if (result) {
            const newCharacters = result.map(char => ({...char, id: uuidv4(), relationships:[], motivation: {desire: '', fear: '', need: ''}}));
            dispatch({ type: 'SET_STATE', payload: { characters: newCharacters } });
        }
        dispatch({ type: 'END_ASSIST_CHARACTER', payload: 'new-cast' });
    }, [dispatch, state.initialConcept]);

    const setStructure = useCallback((data: StoryStructure) => {
        dispatch({ type: 'SET_STRUCTURE', payload: data });
    }, []);

    const assistStructure = useCallback(async () => {
        if (!state.initialConcept || !state.styleAndFormat || state.characters.length === 0) return;
        const result = await runApiCall(dispatch, async () => {
            const prompt = getStructureAssistancePrompt(state.initialConcept!, state.styleAndFormat!, state.characters);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text) as StoryStructure;
        }, 'SET_ASSISTING');
        if (result) {
            dispatch({ type: 'SET_STATE', payload: { storyStructure: result } });
        }
    }, [dispatch, state.initialConcept, state.styleAndFormat, state.characters]);

    const generatePremiumPlan = useCallback(async () => {
        if (!state.enhancedData) {
            // First run, trigger agent orchestrator
            const orchestrator = new AgentOrchestrator();
            dispatch({ type: 'SET_LOADING', payload: true });
            const enhancedData = await orchestrator.processWithAllAgents(
                {
                    initialConcept: state.initialConcept,
                    styleAndFormat: state.styleAndFormat,
                    characters: state.characters,
                    storyStructure: state.storyStructure
                },
                {
                    onAgentStart: (agentName) => dispatch({ type: 'SET_AGENT_PROGRESS', payload: { agent: agentName, progress: [] } }),
                    onAgentProgress: (progress) => {
                        dispatch({ type: 'SET_STATE', payload: { agentProgress: [...state.agentProgress, progress] } });
                    }
                }
            );
            dispatch({ type: 'SET_ENHANCED_DATA', payload: enhancedData });
        } else {
             // Agents have run, now generate the plan
             const result = await runApiCall(dispatch, async () => {
                const prompt = getPremiumStoryPlanPrompt(state);
                const response = await geminiService.generateContent(prompt);
                return parseJsonMarkdown(response.text) as PremiumStoryPlan;
            });
            if (result) {
                dispatch({ type: 'SET_PREMIUM_PLAN', payload: result });
            }
        }
    }, [dispatch, state]);

     const generatePremiumDocs = useCallback(async () => {
        if (!state.premiumPlan) return;
        const result = await runApiCall(dispatch, async () => {
            const prompt = getPremiumDocumentationPrompt(state.premiumPlan!);
            const response = await geminiService.generateContent(prompt);
            return parseJsonMarkdown(response.text) as PremiumDocumentation;
        });
        if (result) {
            dispatch({ type: 'SET_PREMIUM_DOCS', payload: result });
        }
    }, [dispatch, state.premiumPlan]);

    const runFinalEvaluation = useCallback(async () => {
        // Mocked evaluation
        const result = await runApiCall(dispatch, async () => {
            await new Promise(res => setTimeout(res, 2000));
            return {
                overall_score: 9.2,
            };
        });
        if(result) {
            dispatch({ type: 'SET_FINAL_EVALUATION', payload: result });
        }
    }, [dispatch]);
    
    // --- MOCKED/PLACEHOLDER ACTIONS for later phases ---
    const generateCharacterReferences = useCallback(async () => {
       logger.log('INFO', 'StateMachine', 'generateCharacterReferences called');
       // Placeholder
    }, []);
    const generateStoryboard = useCallback(async (aspectRatio: string) => {
       logger.log('INFO', 'StateMachine', 'generateStoryboard called');
       // Placeholder
    }, []);
    const regenerateStoryboardPanel = useCallback(async (panel: StoryboardPanel, instruction?: string) => {
       logger.log('INFO', 'StateMachine', 'regenerateStoryboardPanel called for', panel.id);
       // Placeholder
    }, []);
    const generateFinalAssets = useCallback(async (selectedScenes: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => {
       logger.log('INFO', 'StateMachine', 'generateFinalAssets called');
       // Placeholder
    }, []);


    const actions = {
        goToPhase,
        setConcept,
        assistConcept,
        setStyle,
        suggestStyle,
        setCharacters,
        assistCharacter,
        generateCharacterCast,
        setStructure,
        assistStructure,
        generatePremiumPlan,
        generatePremiumDocs,
        runFinalEvaluation,
        generateCharacterReferences,
        generateStoryboard,
        regenerateStoryboardPanel,
        generateFinalAssets,
    };

    return { state, actions };
}
