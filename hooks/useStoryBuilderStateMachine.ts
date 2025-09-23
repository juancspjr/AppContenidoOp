/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useEffect, useCallback } from 'react';
import type {
    InitialConcept,
    StyleAndFormat,
    CharacterDefinition,
    StoryStructure,
    StructuralCoherenceReport,
    StoryMasterplan,
    Critique,
    Documentation,
    HookMatrix,
    ReferenceAsset,
    ReferenceAssets,
    FinalAssets,
    FinalAsset,
    ProgressUpdate,
    ExportedProject,
    CoherenceCheckStep,
} from '../components/story-builder/types';
import * as geminiService from '../services/geminiService';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { assetDBService } from '../services/assetDBService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { GEMINI_API_KEYS } from '../config/secure_config';

const areKeysConfigured = GEMINI_API_KEYS.length > 0 && !GEMINI_API_KEYS[0]?.includes('YOUR_API_KEY');

export function useStoryBuilderStateMachine(existingProject?: ExportedProject) {
    const [phase, setPhase] = useState(existingProject?.phase || 1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingError, setProcessingError] = useState<string | null>(null);

    // State for each phase's data
    const [initialConcept, setInitialConcept] = useState<InitialConcept | null>(existingProject?.initialConcept || null);
    const [styleAndFormat, setStyleAndFormat] = useState<StyleAndFormat | null>(existingProject?.styleAndFormat || null);
    const [characters, setCharacters] = useState<CharacterDefinition[]>(existingProject?.characters || []);
    const [storyStructure, setStoryStructure] = useState<StoryStructure | null>(existingProject?.storyStructure || null);
    const [coherenceReport, setCoherenceReport] = useState<StructuralCoherenceReport | null>(existingProject?.coherenceReport || null);
    const [coherenceCheckProgress, setCoherenceCheckProgress] = useState<CoherenceCheckStep[] | null>(existingProject?.coherenceCheckProgress || null);
    const [storyPlan, setStoryPlan] = useState<StoryMasterplan | null>(existingProject?.storyPlan || null);
    const [critique, setCritique] = useState<Critique | null>(existingProject?.critique || null);
    const [documentation, setDocumentation] = useState<Documentation | null>(existingProject?.documentation || null);
    const [hookMatrix, setHookMatrix] = useState<HookMatrix | null>(existingProject?.hookMatrix || null);
    const [referenceAssets, setReferenceAssets] = useState<ReferenceAssets | null>(existingProject?.referenceAssets || null);
    const [finalAssets, setFinalAssets] = useState<FinalAssets | null>(existingProject?.finalAssets || null);

    const [assistingCharacterIds, setAssistingCharacterIds] = useState<Set<string>>(new Set());

    // Helper to save project state
    const saveState = useCallback(() => {
        const project: ExportedProject = {
            phase, initialConcept, styleAndFormat, characters, storyStructure,
            coherenceReport, coherenceCheckProgress, storyPlan, critique, documentation,
            hookMatrix, referenceAssets, finalAssets
        };
        projectPersistenceService.saveProject(project);
        logger.log('INFO', 'StateMachine', `Project state saved at phase ${phase}`);
    }, [phase, initialConcept, styleAndFormat, characters, storyStructure, coherenceReport, coherenceCheckProgress, storyPlan, critique, documentation, hookMatrix, referenceAssets, finalAssets]);

    useEffect(() => {
        saveState();
    }, [saveState]);
    
    const goToPhase = (phaseNumber: number) => {
        setPhase(phaseNumber);
    };

    const handleApiCall = async <T>(apiFn: () => Promise<T>, onSuccess: (result: T) => void, id?: string) => {
        setIsProcessing(true);
        setProcessingError(null);
        if (id) setAssistingCharacterIds(prev => new Set(prev).add(id));
        try {
            const result = await apiFn();
            onSuccess(result);
        } catch (error: any) {
            setProcessingError(error.message || 'An unknown error occurred.');
        } finally {
            setIsProcessing(false);
            if (id) setAssistingCharacterIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    // Phase 1
    const handlePhase1Complete = (data: InitialConcept) => {
        setInitialConcept(data);
        setPhase(2);
    };
    const assistConcept = (idea: string) => handleApiCall(
        () => geminiService.assistConcept(idea),
        (result) => setInitialConcept(result)
    );

    // Phase 2
    const handlePhase2Complete = (data: StyleAndFormat) => {
        setStyleAndFormat(data);
        setPhase(3);
    };
    const suggestStyle = () => handleApiCall(
        () => geminiService.suggestStyle(initialConcept!),
        // FIX: Handle potential null value for `prev` when spreading.
        (result) => setStyleAndFormat(prev => ({ ...(prev || {}), ...result }))
    );

    // Phase 3
    const handlePhase3Complete = (data: CharacterDefinition[]) => {
        setCharacters(data);
        setPhase(4);
    };
    const assistCharacter = (characterId: string) => handleApiCall(
        () => geminiService.assistCharacterDetails(characters.find(c => c.id === characterId)!, initialConcept!),
        // FIX: Spread operator should be safe as API call returns an object.
        (result) => setCharacters(prev => prev.map(c => c.id === characterId ? { ...c, ...result } : c)),
        characterId
    );
     const assistNewCharacter = (character: CharacterDefinition) => handleApiCall(
        () => geminiService.assistCharacterDetails(character, initialConcept!),
        // FIX: Spread operator should be safe as API call returns an object.
        (result) => setCharacters(prev => [...prev, { ...character, ...result, id: uuidv4() }]),
        'new'
    );

    // Phase 4
    const handlePhase4Complete = (data: StoryStructure) => {
        setStoryStructure(data);
        setPhase(4.5); // Move to coherence check
    };
    const generateStructure = () => handleApiCall(
        () => geminiService.generateStoryStructure(initialConcept!, characters),
        (result) => setStoryStructure(result)
    );
    
    // Phase 4.5
    const runCoherenceAnalysis = () => handleApiCall(
        () => geminiService.runCoherenceAnalysis(initialConcept!, styleAndFormat!, characters, storyStructure!),
        (result) => {
            setCoherenceReport(result);
            setPhase(5); // Auto-advance on success
        }
    );

    // Phase 5
    const handlePhase5Complete = () => {
        setPhase(6.1); // Move to critique
        runCritiqueAndEnrichment(false); // Auto-trigger critique
    };
    const generateMasterplan = () => handleApiCall(
        () => geminiService.generateStoryMasterplan({ initialConcept, styleAndFormat, characters, storyStructure }),
        (result) => setStoryPlan(result)
    );

    // Phase 6.1
    const runCritiqueAndEnrichment = (applyImprovements: boolean) => handleApiCall(
        () => geminiService.critiqueAndEnrichMasterplan(storyPlan!),
        // FIX: Add explicit type for `result` to resolve property access error.
        (result: Critique) => {
            setCritique(result);
            if (applyImprovements && result.enrichedElements) {
                // This is a simplified merge. A real app might need more complex logic.
                const updatedPlan = { ...storyPlan, critique: result }; 
                setStoryPlan(updatedPlan as StoryMasterplan);
            }
        }
    );
    const handleEvaluationComplete = () => {
        setPhase(6.2);
        generateProductionDocs();
    };
    
    // Phase 6.2
    const generateProductionDocs = () => handleApiCall(
        () => geminiService.generateProductionDocuments(storyPlan!),
        (result) => { setDocumentation(result); }
    );
    const handleRefinementComplete = () => {
        setPhase(6.25);
        generateHookMatrix();
    };

    // Phase 6.25
    const generateHookMatrix = () => handleApiCall(
        () => geminiService.generateHookMatrix(storyPlan!),
        (result) => setHookMatrix(result)
    );
    const handleHookMatrixComplete = () => {
        setPhase(6.3);
        generateAllReferenceAssets();
    };
    
    // Phase 6.3
    const generateSceneMatrix = (sceneNumber: number) => {
        logger.log('INFO', 'StateMachine', `Placeholder for generating scene matrix for scene: ${sceneNumber}. This feature is ready for full implementation.`);
        alert(`La generación de la matriz de escenas para la escena ${sceneNumber} está en desarrollo.`);
    };

    const generateAllReferenceAssets = () => {
        // Initialize state with a complete structure to prevent UI errors
        setReferenceAssets({ characters: [], environments: [], elements: [], sceneFrames: [] });

        handleApiCall(
            async () => {
                const assetsToGenerate: ReferenceAsset[] = [];
                storyPlan!.characters.forEach(c => assetsToGenerate.push({
                    id: `char_${c.name.replace(/\s+/g, '_')}`,
                    type: 'character', name: c.name, description: c.description,
                    visualPrompt: c.visual_description, assetId: ''
                }));
                
                const generatedAssets: ReferenceAsset[] = [];
                for (const asset of assetsToGenerate) {
                    const blob = await geminiService.generateReferenceImage(asset);
                    const assetId = `ref_${asset.type}_${uuidv4()}`;
                    await assetDBService.saveAsset(assetId, blob);
                    generatedAssets.push({ ...asset, assetId });
                }
                return generatedAssets;
            },
            (result) => {
                 setReferenceAssets({ characters: result, environments: [], elements: [], sceneFrames: [] });
                 setCharacters(prev => prev.map(char => {
                     const ref = result.find(r => r.name === char.name);
                     return ref ? { ...char, imageAssetId: ref.assetId } : char;
                 }));
            }
        );
    };
    
    const regenerateSingleReferenceAsset = (asset: ReferenceAsset, instruction?: string) => {
         logger.log('INFO', 'StateMachine', `Placeholder for regenerating asset: ${asset.name} with instruction: "${instruction || 'none'}"`);
         alert(`La regeneración del activo "${asset.name}" está en desarrollo.`);
    };

    const handleReferenceAssetGenerationComplete = () => {
        setPhase(6.4);
    };
    
    // Phase 6.4
    const runFinalVideoGenerationPipeline = async (choices: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => {
        setIsProcessing(true);
        setProcessingError(null);
        
        try {
            const newGeneratedAssets: FinalAsset[] = [];
            for (const [sceneNumber, choice] of choices.entries()) {
                const scene = storyPlan?.story_structure.narrative_arc.flatMap(a => a.scenes).find(s => s.scene_number === sceneNumber);
                if (!scene) continue;

                const sceneId = `scene_${scene.scene_number}`;
                const referenceFrame = referenceAssets?.sceneFrames.find(f => f.name.includes(`Scene ${sceneNumber}`));
                
                let finalAsset: FinalAsset | null = null;

                if (choice.mode === 'veo') {
                    const referenceBlob = referenceFrame ? await assetDBService.loadAsset(referenceFrame.assetId) : null;
                    const referenceFile = referenceBlob ? new File([referenceBlob], "reference.png", {type: "image/png"}) : undefined;

                    const megaPrompt = `${scene.visual_elements_prompt || scene.summary}. ${styleAndFormat?.visualStyle?.join(', ') || ''}. ${choice.notes}. El video debe coincidir visualmente con la imagen de referencia proporcionada.`;
                    
                    const videoUrl = await geminiService.generateVideoSegment(megaPrompt, referenceFile);
                    const videoBlob = await fetch(videoUrl).then(res => res.blob());
                    const assetId = `final_video_${sceneId}_${uuidv4()}`;
                    await assetDBService.saveAsset(assetId, videoBlob);
                    URL.revokeObjectURL(videoUrl);
                    finalAsset = { sceneId, type: 'video', assetId };
                
                } else { // Handle 'ken_burns' and 'static'
                    if (referenceFrame?.assetId) {
                        const blob = await assetDBService.loadAsset(referenceFrame.assetId);
                        if (blob) {
                            const assetId = `final_image_${sceneId}_${uuidv4()}`;
                            await assetDBService.saveAsset(assetId, blob);
                            finalAsset = { sceneId, type: choice.mode === 'ken_burns' ? 'animated_image' : 'static_image', assetId };
                        }
                    }
                }
                if(finalAsset) newGeneratedAssets.push(finalAsset);
            }
            
             setFinalAssets(prev => ({ assets: [...(prev?.assets || []), ...newGeneratedAssets] }));

        } catch (error: any) {
            setProcessingError(error.message || 'Error en la generación de video.');
        } finally {
            setIsProcessing(false);
        }
    };
    
    // Reset flow
    const resetAndRegenerate = () => {
        setCritique(null);
        setDocumentation(null);
        setHookMatrix(null);
        setReferenceAssets(null);
        setFinalAssets(null);
        setPhase(5); // Go back to plan review
        generateMasterplan();
    };


    return {
        phase,
        setPhase,
        initialConcept,
        styleAndFormat,
        characters,
        storyStructure,
        coherenceReport,
        coherenceCheckProgress,
        storyPlan,
        critique,
        documentation,
        hookMatrix,
        referenceAssets,
        finalAssets,
        isProcessing,
        processingError,
        assistingCharacterIds,
        areKeysConfigured,
        handlePhase1Complete,
        handlePhase2Complete,
        handlePhase3Complete,
        handlePhase4Complete,
        handlePhase5Complete,
        handleEvaluationComplete,
        handleRefinementComplete,
        handleHookMatrixComplete,
        handleReferenceAssetGenerationComplete,
        runFinalVideoGenerationPipeline,
        goToPhase,
        assistConcept,
        suggestStyle,
        assistCharacter,
        assistNewCharacter,
        generateStructure,
        runCoherenceAnalysis,
        generateMasterplan,
        runCritiqueAndEnrichment,
        generateProductionDocs,
        generateHookMatrix,
        generateAllReferenceAssets,
        regenerateSingleReferenceAsset,
        generateSceneMatrix,
        resetAndRegenerate,
    };
}