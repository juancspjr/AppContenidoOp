/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useReducer, useEffect, useMemo, useCallback } from 'react';
import type { 
    ExportedProject,
    InitialConcept,
    StyleAndFormat,
    CharacterDefinition,
    StoryStructure,
    StructuralCoherenceReport,
    StoryMasterplan,
    Critique,
    Documentation,
    ReferenceAssets,
    FinalAssets,
    ProgressUpdate,
    HookMatrix,
    ReferenceAsset,
    CoherenceCheckStep,
    CoherenceCheckItem,
} from '../components/story-builder/types';
import { 
    generateStoryMasterplan,
    critiqueStoryMasterplan,
    applyCritiqueToMasterplan,
    generateProductionBible,
    generateReferenceAssets,
    regenerateSingleReferenceAsset,
    generateVideoAssets,
    runStructuralCoherenceCheck,
    generateHookMatrix,
    orchestrateStyleGeneration,
    orchestrateCharacterGeneration,
    orchestrateConceptGeneration,
    generateOrImproveStoryStructure,
    suggestCharacterRelationships,
    applyCoherenceFixes,
} from '../services/geminiService';
import { logger } from '../utils/logger';
import { formatApiError } from '../utils/errorUtils';

type LocalLoadingState = {
    concept: boolean;
    style: boolean;
    structure: boolean;
    characters: Set<string>;
};

type State = ExportedProject & {
    isLoading: boolean;
    error: string | null;
    progress: Record<string, ProgressUpdate>;
    localLoading: LocalLoadingState;
};

type Action =
  | { type: 'LOAD_PROJECT', payload: ExportedProject }
  | { type: 'SET_PHASE', payload: number }
  | { type: 'START_LOADING' }
  | { type: 'STOP_LOADING' }
  | { type: 'SET_ERROR', payload: string | null }
  | { type: 'SET_PROGRESS', payload: ProgressUpdate }
  | { type: 'CLEAR_PROGRESS' }
  | { type: 'SET_LOCAL_LOADING', payload: { key: keyof LocalLoadingState, value: boolean, id?: string } }
  | { type: 'SET_INITIAL_CONCEPT', payload: InitialConcept }
  | { type: 'SET_STYLE_AND_FORMAT', payload: Partial<StyleAndFormat> }
  | { type: 'SET_CHARACTERS', payload: CharacterDefinition[] }
  | { type: 'UPDATE_CHARACTER', payload: CharacterDefinition }
  | { type: 'SET_STORY_STRUCTURE', payload: StoryStructure }
  | { type: 'SET_COHERENCE_REPORT', payload: StructuralCoherenceReport | null }
  | { type: 'SET_COHERENCE_CHECK_PROGRESS', payload: CoherenceCheckStep[] | null }
  | { type: 'UPDATE_COHERENCE_CHECK_PROGRESS', payload: CoherenceCheckStep }
  | { type: 'SET_STORY_PLAN', payload: StoryMasterplan | null }
  | { type: 'SET_CRITIQUE', payload: Critique | null }
  | { type: 'SET_DOCUMENTATION', payload: Documentation | null }
  | { type: 'SET_HOOK_MATRIX', payload: HookMatrix | null }
  | { type: 'SET_REFERENCE_ASSETS', payload: ReferenceAssets | null }
  | { type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: ReferenceAsset }
  | { type: 'SET_FINAL_ASSETS', payload: FinalAssets | null }
  | { type: 'APPLY_REFINED_DATA', payload: Partial<ExportedProject> };

const initialState: State = {
    phase: 1,
    isLoading: false,
    error: null,
    progress: {},
    localLoading: {
        concept: false,
        style: false,
        structure: false,
        characters: new Set(),
    },
    initialConcept: null,
    styleAndFormat: null,
    characters: [],
    storyStructure: null,
    coherenceReport: null,
    coherenceCheckProgress: null,
    storyPlan: null,
    critique: null,
    documentation: null,
    hookMatrix: null,
    referenceAssets: null,
    finalAssets: null,
};

const storyBuilderReducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'LOAD_PROJECT': return { ...state, ...action.payload, localLoading: initialState.localLoading };
        case 'SET_PHASE':
            // Cascading State Invalidation Logic
            let newState: State = { ...state, phase: action.payload, error: null };
            if (action.payload <= 4) {
                newState = { ...newState, coherenceReport: null, coherenceCheckProgress: null, storyPlan: null, critique: null, documentation: null, referenceAssets: null, finalAssets: null, hookMatrix: null };
            }
            if (action.payload <= 3) newState = { ...newState, storyStructure: null };
            if (action.payload <= 2) newState = { ...newState, characters: [] };
            if (action.payload <= 1) newState = { ...newState, styleAndFormat: null };
            return newState;
        case 'START_LOADING': return { ...state, isLoading: true, error: null };
        case 'STOP_LOADING': return { ...state, isLoading: false };
        case 'SET_ERROR': return { ...state, error: action.payload, isLoading: false };
        case 'SET_PROGRESS': return { ...state, progress: { ...state.progress, [action.payload.stage]: action.payload }};
        case 'CLEAR_PROGRESS': return { ...state, progress: {} };
        case 'SET_LOCAL_LOADING':
            const { key, value, id } = action.payload;
            if (key === 'characters') {
                const newCharSet = new Set(state.localLoading.characters);
                if (value && id) newCharSet.add(id);
                else if (id) newCharSet.delete(id);
                return { ...state, localLoading: { ...state.localLoading, characters: newCharSet } };
            }
            return { ...state, localLoading: { ...state.localLoading, [key]: value } };
        case 'SET_INITIAL_CONCEPT': return { ...state, initialConcept: action.payload };
        case 'SET_STYLE_AND_FORMAT': {
            const currentStyle = state.styleAndFormat || {};
            const newSuggestions = action.payload;
            
            // FIX: Smartly merge AI suggestions for style notes without overwriting.
            const aiNotes = (newSuggestions as any).styleNotesSuggestion;
            const existingNotes = currentStyle.styleNotes || '';
            const finalNotes = aiNotes 
                ? `${existingNotes}\n\nSugerencia IA: ${aiNotes}`.trim()
                : existingNotes;

            const { styleNotesSuggestion, ...restOfSuggestions } = newSuggestions as any;

            return {
                ...state,
                styleAndFormat: {
                    ...currentStyle,
                    ...restOfSuggestions,
                    styleNotes: finalNotes
                }
            };
        }
        case 'SET_CHARACTERS': return { ...state, characters: action.payload };
        case 'UPDATE_CHARACTER':
            return {
                ...state,
                characters: state.characters.map(c => c.id === action.payload.id ? action.payload : c),
            };
        case 'SET_STORY_STRUCTURE': return { ...state, storyStructure: action.payload };
        case 'SET_COHERENCE_REPORT': return { ...state, coherenceReport: action.payload };
        case 'SET_COHERENCE_CHECK_PROGRESS': return { ...state, coherenceCheckProgress: action.payload };
        case 'UPDATE_COHERENCE_CHECK_PROGRESS':
            if (!state.coherenceCheckProgress) return state;
            return {
                ...state,
                coherenceCheckProgress: state.coherenceCheckProgress.map(step =>
                    step.id === action.payload.id ? { ...step, ...action.payload } : step
                )
            };
        case 'SET_STORY_PLAN': return { ...state, storyPlan: action.payload };
        case 'SET_CRITIQUE': return { ...state, critique: action.payload };
        case 'SET_DOCUMENTATION': return { ...state, documentation: action.payload };
        case 'SET_HOOK_MATRIX': return { ...state, hookMatrix: action.payload };
        case 'SET_REFERENCE_ASSETS': return { ...state, referenceAssets: action.payload };
        case 'UPDATE_SINGLE_REFERENCE_ASSET':
            if (!state.referenceAssets) return state;
            const updateAsset = (a: ReferenceAsset) => a.id === action.payload.id ? action.payload : a;
            return {
                ...state,
                referenceAssets: {
                    characters: state.referenceAssets.characters.map(updateAsset),
                    environments: state.referenceAssets.environments.map(updateAsset),
                    elements: state.referenceAssets.elements.map(updateAsset),
                }
            };
        case 'SET_FINAL_ASSETS': return { ...state, finalAssets: action.payload };
        case 'APPLY_REFINED_DATA':
            return {
                ...state,
                initialConcept: action.payload.initialConcept || state.initialConcept,
                styleAndFormat: action.payload.styleAndFormat || state.styleAndFormat,
                characters: action.payload.characters || state.characters,
                storyStructure: action.payload.storyStructure || state.storyStructure,
            };
        default: return state;
    }
};

export const useStoryBuilderStateMachine = (existingProject?: ExportedProject) => {
    const [state, dispatch] = useReducer(storyBuilderReducer, initialState);

    useEffect(() => {
        if (existingProject) {
            logger.log('INFO', 'StateMachine', 'Loading existing project.', existingProject);
            dispatch({ type: 'LOAD_PROJECT', payload: existingProject });
        }
    }, [existingProject]);

    const handleProgress = useCallback((update: ProgressUpdate) => {
        dispatch({ type: 'SET_PROGRESS', payload: update });
    }, []);

    const reAnalyzeStructure = useCallback(() => {
        if (state.storyStructure) {
            handleStructureComplete(state.storyStructure);
        }
    }, [state.storyStructure]);
    
    // Phase completion handlers
    const handleConceptComplete = (data: InitialConcept) => {
        dispatch({ type: 'SET_INITIAL_CONCEPT', payload: data });
        dispatch({ type: 'SET_PHASE', payload: 2 });
    };
    const handleStyleComplete = (data: StyleAndFormat) => {
        dispatch({ type: 'SET_STYLE_AND_FORMAT', payload: data });
        dispatch({ type: 'SET_PHASE', payload: 3 });
    };
    const handleCharactersComplete = (data: CharacterDefinition[]) => {
        dispatch({ type: 'SET_CHARACTERS', payload: data });
        dispatch({ type: 'SET_PHASE', payload: 4 });
    };

    const handleStructureComplete = async (structure: StoryStructure) => {
        dispatch({ type: 'SET_STORY_STRUCTURE', payload: structure });
        
        const initialProgress: CoherenceCheckStep[] = [
            { id: 'concept', label: 'Analizando Concepto General', status: 'pending' },
            { id: 'consistency', label: 'Verificando Consistencia', status: 'pending' },
            { id: 'pacing', label: 'Evaluando Ritmo y Estructura', status: 'pending' },
            { id: 'arcs', label: 'Analizando Arcos de Personajes', status: 'pending' },
        ];
        dispatch({ type: 'SET_COHERENCE_CHECK_PROGRESS', payload: initialProgress });
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'SET_PHASE', payload: 4.5 });

        try {
            const userInput = { 
                initialConcept: state.initialConcept, 
                styleAndFormat: state.styleAndFormat, 
                characters: state.characters, 
                storyStructure: structure 
            };
            const handleCoherenceProgress = (update: CoherenceCheckStep) => {
                dispatch({ type: 'UPDATE_COHERENCE_CHECK_PROGRESS', payload: update });
            };

            const report = await runStructuralCoherenceCheck(userInput, handleCoherenceProgress);
            dispatch({ type: 'SET_COHERENCE_REPORT', payload: report });

        } catch(e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló el análisis de coherencia: ${friendlyError}` });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };
    
    // Core AI generation functions
    const runMasterplanGeneration = async () => {
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'SET_PHASE', payload: 5 });
        try {
            if (!state.initialConcept || !state.styleAndFormat) {
                throw new Error("Faltan datos de concepto o estilo para generar el plan.");
            }
            const userInput = { initialConcept: state.initialConcept, styleAndFormat: state.styleAndFormat, characters: state.characters, storyStructure: state.storyStructure };
            handleProgress({ stage: 'masterplan', status: 'in_progress', message: 'Generando plan maestro de la historia...' });
            
            const plan = await generateStoryMasterplan(userInput);
            dispatch({ type: 'SET_STORY_PLAN', payload: plan });
            
            handleProgress({ stage: 'masterplan', status: 'complete', message: 'Plan maestro generado.' });
            dispatch({ type: 'SET_PHASE', payload: 5.1 });

        } catch(e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la generación del plan maestro: ${friendlyError}` });
            dispatch({ type: 'SET_PHASE', payload: 4 }); 
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    const runCritiqueOnly = async () => {
        if (!state.storyPlan) return;
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'SET_CRITIQUE', payload: null });
        dispatch({ type: 'CLEAR_PROGRESS' });
        dispatch({ type: 'SET_PHASE', payload: 6.1 });
        try {
            handleProgress({ stage: 'critique', status: 'in_progress', message: 'Generando crítica estratégica...' });
            const initialCritique = await critiqueStoryMasterplan(state.storyPlan);
            dispatch({ type: 'SET_CRITIQUE', payload: initialCritique });
            handleProgress({ stage: 'critique', status: 'complete', message: 'Crítica completada.' });
        } catch(e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la fase de crítica: ${friendlyError}` });
            handleProgress({ stage: 'critique', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    const continueToDocumentation = async () => {
        if (!state.storyPlan) return;
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'CLEAR_PROGRESS' });
        dispatch({ type: 'SET_PHASE', payload: 6.2 });
        try {
            handleProgress({ stage: 'documentation', status: 'in_progress', message: 'Generando documentos de producción...' });
            const docs = await generateProductionBible(state.storyPlan);
            dispatch({ type: 'SET_DOCUMENTATION', payload: docs });
            handleProgress({ stage: 'documentation', status: 'complete', message: 'Documentos generados.' });
        } catch (e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la fase de documentación: ${friendlyError}` });
            handleProgress({ stage: 'documentation', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    const applyImprovements = async () => {
        if (!state.storyPlan) return;
        dispatch({ type: 'START_LOADING' });
        handleProgress({ stage: 'apply_critique', status: 'in_progress', message: 'Aplicando mejoras...' });
        try {
            const improvedPlan = await applyCritiqueToMasterplan(state.storyPlan);
            dispatch({ type: 'SET_STORY_PLAN', payload: improvedPlan });
            dispatch({ type: 'SET_CRITIQUE', payload: null });
            handleProgress({ stage: 'apply_critique', status: 'complete', message: 'Plan mejorado.' });
            await continueToDocumentation(); // Automatically continue after applying
        } catch (e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Fallo al aplicar las mejoras: ${friendlyError}` });
            handleProgress({ stage: 'apply_critique', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    const applyCoherenceFixesAndProceed = async (selectedChecks: CoherenceCheckItem[]) => {
        dispatch({ type: 'START_LOADING' });
        try {
            const storyData = {
                initialConcept: state.initialConcept,
                styleAndFormat: state.styleAndFormat,
                characters: state.characters,
                storyStructure: state.storyStructure,
            };
            const refinedData = await applyCoherenceFixes(storyData, selectedChecks);
            dispatch({ type: 'APPLY_REFINED_DATA', payload: refinedData });
            // FIX: Chain the next action to proceed to Phase 5, breaking the loop.
            await runMasterplanGeneration();
        } catch (e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Fallo al aplicar las mejoras de coherencia: ${friendlyError}` });
            dispatch({ type: 'SET_PHASE', payload: 4.5 }); // Stay on the same page on error
        }
        // No STOP_LOADING here, runMasterplanGeneration will handle it.
    };


    const generateHookMatrixAction = async () => {
        if (!state.storyPlan) return;
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'SET_PHASE', payload: 6.25 });
        try {
             handleProgress({ stage: 'hook_matrix', status: 'in_progress', message: 'Agente "Scroll-Stopper" está generando la matriz de ganchos...' });
             const matrix = await generateHookMatrix(state.storyPlan);
             dispatch({ type: 'SET_HOOK_MATRIX', payload: matrix });
             if (state.storyPlan) {
                dispatch({ type: 'SET_STORY_PLAN', payload: { ...state.storyPlan, hookMatrix: matrix } });
             }
             handleProgress({ stage: 'hook_matrix', status: 'complete', message: 'Matriz de ganchos generada.' });
        } catch(e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la generación de la matriz de ganchos: ${friendlyError}` });
            handleProgress({ stage: 'hook_matrix', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    const startReferenceGeneration = async () => {
        if (!state.storyPlan) return;
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'CLEAR_PROGRESS' });
        dispatch({ type: 'SET_PHASE', payload: 6.3 });
        try {
            handleProgress({ stage: 'reference_assets', status: 'in_progress', message: 'Generando activos de referencia...' });
            const assets = await generateReferenceAssets(state.storyPlan, handleProgress);
            dispatch({ type: 'SET_REFERENCE_ASSETS', payload: assets });
            handleProgress({ stage: 'reference_assets', status: 'complete', message: 'Activos de referencia completados.' });
        } catch (e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la generación de activos de referencia: ${friendlyError}` });
            handleProgress({ stage: 'reference_assets', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };
    
    const regenerateSingleAsset = async (assetToRegen: ReferenceAsset) => {
        dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: { ...assetToRegen, generationStatus: 'generating' } });
        try {
            const newAsset = await regenerateSingleReferenceAsset(assetToRegen);
            dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: newAsset });
        } catch (e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Fallo al regenerar ${assetToRegen.name}: ${friendlyError}` });
            dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: { ...assetToRegen, generationStatus: 'failed' } });
        }
    };

    const startVideoGeneration = async () => {
        if (!state.storyPlan || !state.referenceAssets) return;
        dispatch({ type: 'START_LOADING' });
        dispatch({ type: 'SET_FINAL_ASSETS', payload: null });
        dispatch({ type: 'CLEAR_PROGRESS' });
        dispatch({ type: 'SET_PHASE', payload: 6.4 });
        try {
             const finalVideoAssets = await generateVideoAssets(state.storyPlan, state.referenceAssets, handleProgress);
             dispatch({ type: 'SET_FINAL_ASSETS', payload: finalVideoAssets });
             handleProgress({ stage: 'complete', status: 'complete', message: 'Todos los videos han sido generados.' });
        } catch(e) {
            const friendlyError = formatApiError(e);
            dispatch({ type: 'SET_ERROR', payload: `Falló la generación de video: ${friendlyError}` });
            handleProgress({ stage: 'complete', status: 'error', message: friendlyError });
        } finally {
            dispatch({ type: 'STOP_LOADING' });
        }
    };

    // AI Acceleration Actions
    const assistConcept = async (idea: string) => {
        dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'concept', value: true } });
        try {
            const result = await orchestrateConceptGeneration(idea, state.initialConcept);
            dispatch({ type: 'SET_INITIAL_CONCEPT', payload: result });
        } catch (e) {
            alert(`Error de la IA: ${formatApiError(e)}`);
        } finally {
            dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'concept', value: false } });
        }
    };

    const suggestStyle = async () => {
        if (!state.initialConcept) return;
        dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'style', value: true } });
        try {
            const suggestions = await orchestrateStyleGeneration(state.initialConcept);
            dispatch({ type: 'SET_STYLE_AND_FORMAT', payload: suggestions });
        } catch (e) {
            alert(`Error de la IA: ${formatApiError(e)}`);
        } finally {
            dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'style', value: false } });
        }
    };

    const assistCharacter = async (charId: string) => {
        const character = state.characters.find(c => c.id === charId);
        if (!character || !state.initialConcept || !state.styleAndFormat) return;
        
        dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'characters', id: charId, value: true } });
        try {
            const context = { concept: state.initialConcept, style: state.styleAndFormat };
            const result = await orchestrateCharacterGeneration(context, character);
            const updatedCharacter = { ...character, ...result, motivation: {...character.motivation, ...result.motivation} };
            dispatch({ type: 'UPDATE_CHARACTER', payload: updatedCharacter });
        } catch (e) {
             alert(`Error de la IA: ${formatApiError(e)}`);
        } finally {
             dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'characters', id: charId, value: false } });
        }
    };

    // FIX: Create a new action to handle assistance for a new character, providing full context.
    const assistNewCharacter = async (newCharData: Partial<CharacterDefinition>): Promise<Partial<CharacterDefinition>> => {
        if (!state.initialConcept || !state.styleAndFormat) {
            throw new Error("El concepto y el estilo de la historia deben definirse primero.");
        }
        const context = { concept: state.initialConcept, style: state.styleAndFormat };
        return await orchestrateCharacterGeneration(context, newCharData);
    };

    const generateStructure = async () => {
        if (!state.initialConcept || !state.styleAndFormat) return;
        dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'structure', value: true } });
        try {
            const context = { concept: state.initialConcept, style: state.styleAndFormat, characters: state.characters };
            const result = await generateOrImproveStoryStructure(context, state.storyStructure || {});
            dispatch({ type: 'SET_STORY_STRUCTURE', payload: { ...state.storyStructure, ...result } });
        } catch (e) {
            alert(`Error de la IA: ${formatApiError(e)}`);
        } finally {
            dispatch({ type: 'SET_LOCAL_LOADING', payload: { key: 'structure', value: false } });
        }
    };


    const actions = useMemo(() => ({
        handleConceptComplete,
        handleStyleComplete,
        handleCharactersComplete,
        handleStructureComplete,
        runMasterplanGeneration,
        applyCoherenceFixesAndProceed,
        reAnalyzeStructure,
        runCritiqueOnly,
        continueToDocumentation,
        applyImprovements,
        generateHookMatrix: generateHookMatrixAction,
        startReferenceGeneration,
        regenerateSingleAsset,
        startVideoGeneration,
        assistConcept,
        suggestStyle,
        assistCharacter,
        assistNewCharacter,
        generateStructure,
        updateStoryPlan: (plan: StoryMasterplan) => dispatch({ type: 'SET_STORY_PLAN', payload: plan }),
        goToPhase: (phase: number) => dispatch({ type: 'SET_PHASE', payload: phase }),
        goToPhase1: () => dispatch({ type: 'SET_PHASE', payload: 1 }),
        goToPhase2: () => dispatch({ type: 'SET_PHASE', payload: 2 }),
        goToPhase3: () => dispatch({ type: 'SET_PHASE', payload: 3 }),
        goToPhase4: () => dispatch({ type: 'SET_PHASE', payload: 4 }),
    }), [state.storyPlan, state.referenceAssets, state.initialConcept, state.styleAndFormat, state.characters, state.storyStructure, reAnalyzeStructure]);
    
    return { state, actions };
};
