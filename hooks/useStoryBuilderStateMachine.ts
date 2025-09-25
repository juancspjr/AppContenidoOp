/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
    ExportedProject, InitialConcept, StyleAndFormat, CharacterDefinition, 
    StoryStructure, StructuralCoherenceReport, CoherenceCheckStep, 
    StoryMasterplan, Critique, Documentation, HookMatrix, ReferenceAsset, 
    ReferenceAssets, FinalAsset, FinalAssets, ProgressUpdate, VideosOperationResponse, 
    StoryBuilderState, 
    StoryboardPanel,
    StoryboardGroupPrompt,
    CritiqueProgressStep
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
    | { type: 'API_SUCCESS'; payload: Partial<StoryBuilderState> }
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
    | { type: 'API_VIRALITY_SUGGESTIONS_SUCCESS'; payload: { strategies: Critique['improvementStrategies'] } }
    | { type: 'API_APPLY_IMPROVEMENTS_START' };

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
    hookMatrix: null,
    referenceAssets: null,
    storyboardAssets: null,
    finalAssets: null,
};

// Add loading states to the initial state
const fullInitialState: StoryBuilderState & { 
    isLoading: boolean; isAssisting: boolean; error: string | null; assistingCharacterIds: Set<string>; progress: Record<string, ProgressUpdate>; isSuggestingVirality: boolean; isApplyingImprovements: boolean;
} = {
    ...initialState,
    isLoading: false,
    isAssisting: false,
    error: null,
    assistingCharacterIds: new Set(),
    progress: {},
    isSuggestingVirality: false,
    isApplyingImprovements: false,
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
            };
        }
        case 'GO_TO_PHASE': {
            const targetPhase = action.payload;
            const isMovingToPreviousMajorStep = Math.floor(targetPhase) < Math.floor(state.phase);
            const isMovingWithinCurrentMajorStep = Math.floor(targetPhase) === Math.floor(state.phase);

            if (isMovingToPreviousMajorStep || isMovingWithinCurrentMajorStep) {
                 return { ...state, phase: targetPhase, error: null };
            }
            
            return state;
        }
        case 'COMPLETE_PHASE_AND_ADVANCE': {
            const forwardTransitions: { [key: string]: number } = {
                '4': 4.5,
                '4.5': 5,
                '5': 6.1,
                // Phase 6.1 now requires explicit approval to move forward
                '6.2': 6.25,
                '6.25': 6.3,
                '6.3': 6.4,
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
            return { ...state, phase: 4.5, storyStructure: action.payload, error: null };
        case 'API_START':
            const isAssist = action.payload?.isAssisting || false;
            return { ...state, isLoading: !isAssist, isAssisting: isAssist, error: null, critiqueProgress: isAssist ? state.critiqueProgress : null };
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
             const updateAsset = (assets: ReferenceAsset[]) => assets.map(a => a.id === action.payload.id ? action.payload : a);
             if (!state.referenceAssets) {
                const initialAssets: ReferenceAssets = { characters: [], environments: [], elements: [], sceneFrames: [] };
                if (action.payload.type === 'character') initialAssets.characters = [action.payload];
                return { ...state, referenceAssets: initialAssets };
             }
             return { ...state, referenceAssets: {
                 characters: action.payload.type === 'character' ? updateAsset(state.referenceAssets.characters) : state.referenceAssets.characters,
                 environments: action.payload.type === 'environment' ? updateAsset(state.referenceAssets.environments) : state.referenceAssets.environments,
                 elements: action.payload.type === 'element' ? updateAsset(state.referenceAssets.elements) : state.referenceAssets.elements,
                 sceneFrames: action.payload.type === 'scene_frame' ? updateAsset(state.referenceAssets.sceneFrames) : state.referenceAssets.sceneFrames,
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
            const existingStrategyIds = new Set(state.critique.improvementStrategies.map(s => s.id));
            const newUniqueStrategies = action.payload.strategies.filter(s => !existingStrategyIds.has(s.id));
            return {
                ...state,
                isSuggestingVirality: false,
                critique: {
                    ...state.critique,
                    improvementStrategies: [...state.critique.improvementStrategies, ...newUniqueStrategies]
                }
            };
        case 'API_APPLY_IMPROVEMENTS_START':
            return { ...state, isApplyingImprovements: true, error: null };
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
            Object.assign(initialState, project);
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
        };
        projectPersistenceService.saveProject(serializableState as unknown as ExportedProject);
    }, [state]);

    const runStreamingApiCall = useCallback(async (
        promptFn: () => any,
        progressActionType: 'UPDATE_COHERENCE_PROGRESS' | 'UPDATE_CRITIQUE_PROGRESS',
        successAction: (data: any) => Action
    ) => {
        dispatch({ type: 'API_START' });
        try {
            const textModel = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
            const prompt = promptFn();
            const responseStream = await geminiService.generateContentStream(prompt, textModel);

            // Accumulate the entire response to avoid parsing errors from newlines inside JSON strings.
            let fullResponseText = '';
            for await (const chunk of responseStream) {
                fullResponseText += chunk.text;
            }

            // Separate progress lines from the main JSON body.
            // This assumes progress updates are self-contained on their own lines as requested in the prompt.
            const lines = fullResponseText.split('\n');
            const progressLines: string[] = [];
            const mainJsonLines: string[] = [];

            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('{"progress":') && trimmedLine.endsWith('}')) {
                    progressLines.push(trimmedLine);
                } else {
                    mainJsonLines.push(line);
                }
            });

            // Dispatch all progress updates. This is a UX tradeoff for parsing correctness.
            for (const line of progressLines) {
                try {
                    const jsonObj = parseJsonMarkdown(line);
                    if (jsonObj.progress) {
                        dispatch({ type: progressActionType as any, payload: jsonObj.progress });
                    }
                } catch (e) {
                    logger.log('WARNING', 'StateMachine', "Could not parse progress line from buffered response", { line, error: e });
                }
            }

            // Parse the main JSON payload from the remaining lines.
            const mainJsonString = mainJsonLines.join('\n');
            if (!mainJsonString.trim()) {
                 throw new Error("Stream finished, but no main JSON payload was found after filtering progress updates.");
            }

            const finalJson = parseJsonMarkdown(mainJsonString);
            dispatch(successAction(finalJson));

        } catch (error) {
            dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
        }
    }, [state.initialConcept]);


    const apiCall = useCallback(async <T>(
        requestFn: (modelName: string) => Promise<any>,
        onSuccess: (data: any) => Partial<StoryBuilderState>,
        isAssist = false
    ): Promise<T | void> => {
        dispatch({ type: 'API_START', payload: { isAssisting: isAssist } });
        try {
            const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
            const response = await requestFn(modelName);
            const text = response.text;
            const data = parseJsonMarkdown(text);
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

    const runCritique = useCallback(async (isRefinement = false, userSelections?: any) => {
        if (!state.storyPlan) return;
        await runStreamingApiCall(
            () => Prompts.getCritiquePrompt(state.storyPlan!, isRefinement, userSelections),
            'UPDATE_CRITIQUE_PROGRESS',
            (data) => {
                // The API nests the critique object. We need to extract it.
                const critiqueData = data.report_alpha?.critique || data.report_beta?.critique || data.critique || data;
                return { type: 'API_SUCCESS', payload: { critique: critiqueData, critiqueStage: isRefinement ? 'beta' : 'alpha' } }
            }
        );
    }, [state.storyPlan, runStreamingApiCall]);

    const actions = useMemo(() => ({
        goToPhase: (phase: number) => dispatch({ type: 'GO_TO_PHASE', payload: phase }),
        completePhaseAndAdvance: () => dispatch({ type: 'COMPLETE_PHASE_AND_ADVANCE' }),
        setConcept: (data: InitialConcept) => dispatch({ type: 'SET_CONCEPT', payload: data }),
        setStyle: (data: StyleAndFormat) => dispatch({ type: 'SET_STYLE', payload: data }),
        setCharacters: (data: CharacterDefinition[]) => dispatch({ type: 'SET_CHARACTERS', payload: data }),
        setStructure: (data: StoryStructure) => dispatch({ type: 'SET_STRUCTURE', payload: data }),

        assistConcept: async (idea: string) => {
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getConceptAssistancePrompt(idea), model),
                (data) => ({ initialConcept: { ...data, selectedTextModel: state.initialConcept?.selectedTextModel, selectedImageModel: state.initialConcept?.selectedImageModel } }),
                true
            );
        },

        suggestStyle: async () => {
            if (!state.initialConcept) return;
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStyleSuggestionPrompt(state.initialConcept!), model),
                (data) => ({ styleAndFormat: data }),
                true
            );
        },

        assistCharacter: async (characterId: string) => {
            const character = state.characters.find(c => c.id === characterId);
            if (!character || !state.initialConcept) return;
            dispatch({ type: 'API_ASSIST_CHAR_START', payload: characterId });
            try {
                const modelName = state.initialConcept.selectedTextModel || 'gemini-2.5-flash';
                const response = await geminiService.generateContent(Prompts.getCharacterAssistancePrompt(character, state.initialConcept), modelName);
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
                const response = await geminiService.generateContent(Prompts.getCharacterCastPrompt(state.initialConcept), modelName);
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
            if (!state.initialConcept || !state.styleAndFormat || state.characters.length === 0) return;
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStructureAssistancePrompt(state.initialConcept!, state.styleAndFormat!, state.characters), model),
                (data) => ({ storyStructure: data }),
                true
            );
        },

        runCoherenceCheck: async () => {
             await runStreamingApiCall(
                () => Prompts.getCoherenceCheckPrompt(state),
                'UPDATE_COHERENCE_PROGRESS',
                (data) => ({ type: 'API_SUCCESS', payload: { coherenceReport: data.report } })
            );
        },
        
        applyCoherenceSuggestions: async (suggestionsToApply: StructuralCoherenceReport['checks']) => {
            dispatch({ type: 'API_START', payload: { isAssisting: true } });
            try {
                const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
                const response = await geminiService.generateContent(
                    Prompts.getApplyCoherenceSuggestionsPrompt(state, suggestionsToApply), modelName
                );
                const updatedData = parseJsonMarkdown(response.text);

                const successPayload: Partial<StoryBuilderState> = {
                    initialConcept: updatedData.initialConcept || state.initialConcept,
                    styleAndFormat: updatedData.styleAndFormat ? { ...state.styleAndFormat, ...updatedData.styleAndFormat } : state.styleAndFormat,
                    characters: updatedData.characters || state.characters,
                    storyStructure: updatedData.storyStructure || state.storyStructure,
                    coherenceReport: null,
                };
                
                dispatch({ type: 'API_SUCCESS', payload: successPayload });
                await runStreamingApiCall(
                    () => Prompts.getCoherenceCheckPrompt({ ...state, ...successPayload }),
                    'UPDATE_COHERENCE_PROGRESS',
                    (data) => ({ type: 'API_SUCCESS', payload: { coherenceReport: data.report } })
                );

            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },
        
        generateStoryPlan: async () => {
            await apiCall(
                (model) => geminiService.generateContent(Prompts.getStoryPlanGenerationPrompt(state), model),
                (data) => ({ storyPlan: data })
            );
        },

        runCritique: () => runCritique(false),

        refineCritique: async (selectedStrategies: Critique['improvementStrategies'], userNotes: string) => {
            const sanitizedNotes = userNotes.trim();
            const selections = {
                strategies: selectedStrategies,
                notes: sanitizedNotes || undefined
            };
            await runCritique(true, selections);
        },

        applyCritiqueImprovements: async () => {
            if (!state.critique || !state.storyPlan) return;
            const weaknessesToFix = state.critique.weaknesses.filter(w => w.severity === 'Moderate' || w.severity === 'High');
            if (weaknessesToFix.length === 0) return;

            dispatch({ type: 'API_APPLY_IMPROVEMENTS_START' });

            try {
                const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
                const response = await geminiService.generateContent(Prompts.getApplyCritiqueImprovementsPrompt(state.storyPlan, weaknessesToFix), modelName);
                const updatedStoryPlan = parseJsonMarkdown(response.text);
                
                dispatch({ type: 'API_SUCCESS', payload: { storyPlan: updatedStoryPlan, critique: null, critiqueStage: null, critiqueProgress: null } });
                await runCritique(false);

            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        generateViralitySuggestions: async () => {
            if (!state.storyPlan) return;
            dispatch({ type: 'API_VIRALITY_START' });
            try {
                const modelName = state.initialConcept?.selectedTextModel || 'gemini-2.5-flash';
                const response = await geminiService.generateContent(Prompts.getViralitySuggestionsPrompt(state.storyPlan), modelName);
                const data = parseJsonMarkdown(response.text);
                if (data.improvementStrategies) {
                    dispatch({ type: 'API_VIRALITY_SUGGESTIONS_SUCCESS', payload: { strategies: data.improvementStrategies } });
                } else {
                    throw new Error("AI response did not contain 'improvementStrategies'.");
                }
            } catch (error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        approveCritiqueAndGenerateDocs: async () => {
            if (!state.storyPlan) return;
             await apiCall(
                (model) => geminiService.generateContent(Prompts.getDocumentationDossierPrompt(state.storyPlan!), model),
                (data) => ({
                    storyPlan: data.storyPlan,
                    documentation: data.documentation,
                    hookMatrix: data.hookMatrix,
                    critiqueStage: 'approved',
                    phase: 6.2
                })
            );
        },

        generateCharacterReferences: async () => {
            if (!state.documentation?.aiProductionGuide.prompts.character_master_prompts) {
                dispatch({ type: 'API_ERROR', payload: "Character master prompts not found in documentation." });
                return;
            }
            dispatch({ type: 'API_START' });
        
            const charPrompts = state.documentation.aiProductionGuide.prompts.character_master_prompts;
            const characterNames = Object.keys(charPrompts);
            logger.log('INFO', 'StateMachine', `Generating character references for ${characterNames.length} characters...`);
        
            for (const charName of characterNames) {
                const charData = state.characters.find(c => c.name.toLowerCase() === charName.toLowerCase().replace(/_/g, ' '));
                if (!charData) continue;
        
                const asset: ReferenceAsset = {
                    id: `ref_char_${charData.id}`,
                    type: 'character', name: charData.name, description: charData.description,
                    visualPrompt: '', assetId: `asset_ref_char_${charData.id}`,
                    generationStatus: 'generating'
                };
                dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: asset });
        
                try {
                    const promptData = charPrompts[charName];
                    const visualPrompt = `${promptData.base_description_en}, ${Object.values(promptData.physical_details).join(', ')}, wearing ${promptData.wardrobe_evolution.early_scenes}, ${promptData.lighting_preference} lighting, emotional state: ${promptData.emotional_states.authentic}`;
                    logger.log('DEBUG', 'StateMachine', `Generated visual prompt for ${charData.name}: ${visualPrompt}`);
        
                    const imageModel = state.initialConcept?.selectedImageModel || 'imagen-4.0-generate-001';
                    const imageResponse = await geminiService.generateImages({ prompt: visualPrompt, config: { numberOfImages: 1, outputMimeType: 'image/png' } }, imageModel);
                    const imageBytes = imageResponse.generatedImages[0].image.imageBytes;
                    if (!imageBytes) throw new Error("Image API did not return image bytes.");
        
                    const imageBlob = b64toBlob(imageBytes, 'image/png');
                    await assetDBService.saveAsset(asset.assetId, imageBlob);
        
                    dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: { ...asset, visualPrompt, generationStatus: 'complete' } });
                } catch (error) {
                    dispatch({ type: 'UPDATE_SINGLE_REFERENCE_ASSET', payload: { ...asset, generationStatus: 'error' } });
                    dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
                    break;
                }
            }
            dispatch({ type: 'API_SUCCESS', payload: {} });
        },

        generateStoryboard: async (aspectRatio: string) => {
            if (!state.storyPlan || !state.documentation?.aiProductionGuide.prompts.storyboard_groups) {
                 dispatch({ type: 'API_ERROR', payload: "Storyboard prompts not found in documentation." });
                return;
            }
            dispatch({ type: 'API_START' });
            logger.log('INFO', 'StateMachine', 'Generating 6-panel storyboard...');

            try {
                const storyboardGroupKey = Object.keys(state.documentation.aiProductionGuide.prompts.storyboard_groups)[0];
                const masterPromptJson: StoryboardGroupPrompt = state.documentation.aiProductionGuide.prompts.storyboard_groups[storyboardGroupKey];
                
                const panelDescriptions = Object.values(masterPromptJson.individual_panels).map((p, i) => `Panel ${i + 1} (${p.scene_title}): ${p.description_en}`).join('. ');
                const masterPrompt = `A cinematic storyboard in a 3x2 grid, style of ${masterPromptJson.global_style.aesthetic}. ${panelDescriptions}. Overall lighting: ${masterPromptJson.global_style.lighting}. Overall color palette: ${masterPromptJson.global_style.color_palette}.`;
                logger.log('DEBUG', 'StateMachine', `Generated master storyboard prompt: ${masterPrompt}`);

                const imageModel = state.initialConcept?.selectedImageModel || 'imagen-4.0-generate-001';
                const imageResponse = await geminiService.generateImages({ prompt: masterPrompt, config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio } }, imageModel);
                const imageBytes = imageResponse.generatedImages[0].image.imageBytes;
                if (!imageBytes) throw new Error("La API no devolvió bytes de imagen.");

                const imageBlob = b64toBlob(imageBytes, 'image/png');
                const slicedBlobs = await sliceImageIntoGrid(imageBlob, 2, 3);
                
                const panels: StoryboardPanel[] = [];
                const panelPrompts = Object.values(masterPromptJson.individual_panels);
                for (let i = 0; i < slicedBlobs.length; i++) {
                    const panelInfo = panelPrompts[i];
                    const sceneNumberMatch = (panelInfo.scene_title || `Scene ${i+1}`).match(/\d+/);
                    const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[0], 10) : i + 1;

                    const assetId = `storyboard_${state.storyPlan.metadata.title.replace(/\s+/g, '_')}_panel_${sceneNumber}`;
                    await assetDBService.saveAsset(assetId, slicedBlobs[i]);
                    panels.push({
                        id: `panel_${sceneNumber}`,
                        sceneNumber,
                        assetId,
                        prompt: panelInfo.description_en,
                        narrativeText: panelInfo.dialogue_en,
                        generationStatus: 'complete',
                    });
                }
                logger.log('SUCCESS', 'StateMachine', `Successfully generated and sliced ${panels.length} storyboard panels.`);
                dispatch({ type: 'API_SUCCESS', payload: { storyboardAssets: panels }});

            } catch(error) {
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },
        
        regenerateStoryboardPanel: async (panel: StoryboardPanel, instruction?: string) => {
            if (!state.storyPlan) return;
            const updatedPanel: StoryboardPanel = { ...panel, generationStatus: 'generating' };
            dispatch({ type: 'UPDATE_STORYBOARD_PANEL', payload: updatedPanel });
            logger.log('INFO', 'StateMachine', `Regenerating panel for scene ${panel.sceneNumber}...`);
            try {
                const imageModel = state.initialConcept?.selectedImageModel || 'imagen-4.0-generate-001';
                
                const basePrompt = panel.prompt || `A single panel for a storyboard. Scene: ${panel.sceneNumber}. ${state.storyPlan.creative_brief.visual_style.join(', ')}.`;
                const finalPrompt = instruction ? `${basePrompt}, user instruction: ${instruction}` : basePrompt;
                logger.log('DEBUG', 'StateMachine', `Regeneration prompt: ${finalPrompt}`);

                const response = await geminiService.generateImages({ prompt: finalPrompt, config: { numberOfImages: 1, outputMimeType: 'image/png' } }, imageModel);
                const imageBytes = response.generatedImages[0].image.imageBytes;
                if (!imageBytes) throw new Error("La API no devolvió bytes de imagen.");
                
                const imageBlob = b64toBlob(imageBytes, 'image/png');
                await assetDBService.saveAsset(panel.assetId, imageBlob);

                dispatch({ type: 'UPDATE_STORYBOARD_PANEL', payload: { ...panel, generationStatus: 'complete' } });
            } catch(error) {
                dispatch({ type: 'UPDATE_STORYBOARD_PANEL', payload: { ...panel, generationStatus: 'error' } });
                dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
            }
        },

        generateFinalAssets: async (selectedScenes: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => {
            if (!state.storyPlan || !state.storyboardAssets || !process.env.API_KEY) return;
            dispatch({ type: 'API_START' });

            const finalAssets: FinalAsset[] = [...(state.finalAssets?.assets || [])];

            for (const [sceneNumber, choice] of selectedScenes.entries()) {
                const scene = state.storyPlan.story_structure.narrative_arc.flatMap(a => a.scenes).find(s => s.scene_number === sceneNumber);
                const storyboardPanel = state.storyboardAssets.find(p => p.sceneNumber === sceneNumber);
                if (!scene || !storyboardPanel) continue;

                const assetIdBase = `final_asset_scene_${sceneNumber}`;
                
                dispatch({ type: 'UPDATE_ASSET_GENERATION_PROGRESS', payload: { assetId: assetIdBase, progress: { status: 'generating', progress: 0, message: `Iniciando ${choice.mode}...` } } });
                
                try {
                    let finalAssetId = '';
                    let finalAssetType: FinalAsset['type'] = 'static_image';

                    const basePrompt = scene.visual_elements_prompt || `A cinematic shot for a story. ${scene.summary}`;
                    const finalPrompt = choice.notes ? `${basePrompt}. Director's notes: ${choice.notes}` : basePrompt;
                    const referenceImageBlob = await assetDBService.loadAsset(storyboardPanel.assetId);
                    
                    if (choice.mode === 'veo') {
                        finalAssetType = 'video';
                        const videoRequest: any = { prompt: finalPrompt };
                        if (referenceImageBlob) {
                            videoRequest.image = await fileToGenerativePart(new File([referenceImageBlob], "ref.png"));
                        }
                        const operation = await geminiService.generateVideos(videoRequest);
                        finalAssetId = await pollVideoOperation(operation, process.env.API_KEY);
                    } else if (choice.mode === 'ken_burns') {
                        finalAssetType = 'animated_image';
                        if (referenceImageBlob) {
                             finalAssetId = `ken_burns_${storyboardPanel.assetId}`;
                             await assetDBService.saveAsset(finalAssetId, referenceImageBlob);
                        }
                    } else { // static
                        finalAssetType = 'static_image';
                         if (referenceImageBlob) {
                             finalAssetId = `static_${storyboardPanel.assetId}`;
                             await assetDBService.saveAsset(finalAssetId, referenceImageBlob);
                        }
                    }

                    if (finalAssetId) {
                         const existingIndex = finalAssets.findIndex(a => a.sceneId === `scene_${sceneNumber}`);
                         const newAsset = { sceneId: `scene_${sceneNumber}`, type: finalAssetType, assetId: finalAssetId };
                         if (existingIndex > -1) finalAssets[existingIndex] = newAsset;
                         else finalAssets.push(newAsset);
                         dispatch({ type: 'API_SUCCESS', payload: { finalAssets: { assets: finalAssets } } });
                    }
                    dispatch({ type: 'UPDATE_ASSET_GENERATION_PROGRESS', payload: { assetId: assetIdBase, progress: { status: 'complete', progress: 100 } } });

                } catch (error) {
                    dispatch({ type: 'UPDATE_ASSET_GENERATION_PROGRESS', payload: { assetId: assetIdBase, progress: { status: 'error', message: formatApiError(error) } } });
                    dispatch({ type: 'API_ERROR', payload: formatApiError(error) });
                    break;
                }
            }
            dispatch({ type: 'API_SUCCESS', payload: { isLoading: false } });
        },
    }), [state, apiCall, runStreamingApiCall, pollVideoOperation, runCritique]);

    return { state, actions };
};

const createNewCharacter = (): Partial<CharacterDefinition> => ({
    id: uuidv4(),
    motivation: { desire: '', fear: '', need: '' },
    relationships: [],
});