/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
    StoryMasterplan, 
    Critique, 
    Documentation, 
    ReferenceAssets, 
    FinalAssets, 
    ProgressUpdate, 
    InitialConcept,
    StyleAndFormat,
    CharacterDefinition,
    StoryStructure,
    ExportedProject,
    ReferenceAsset
} from './story-builder/types';
import { 
    generateStoryMasterplan,
    critiqueStoryMasterplan,
    applyCritiqueToMasterplan,
    generateProductionBible,
    generateReferenceAssets,
    generateVideoAssets
} from '../services/geminiService';
import geminiWebService from '../services/geminiWebService';
import Spinner from './Spinner';
import { XCircleIcon, BookOpenIcon, UploadIcon } from './icons';
import EvaluationPhaseView from './story-builder/EvaluationPhaseView';
import RefinementPhaseView from './story-builder/RefinementPhaseView';
import ReferenceAssetView from './story-builder/ReferenceAssetView';
import AssetGenerationView from './story-builder/AssetGenerationView';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { logger } from '../utils/logger';
import { formatApiError } from '../utils/errorUtils';

// Dummy components for phases 1-4 for now
const Phase1_Concept: React.FC<{ onComplete: (data: any) => void, initialData: any }> = ({ onComplete, initialData }) => {
    const [idea, setIdea] = useState(initialData?.idea || '');
    const canProceed = idea.trim().length > 10;
    return <div className="p-4 bg-gray-800 rounded">Phase 1: Concept UI <input value={idea} onChange={e => setIdea(e.target.value)} className="text-black" placeholder="Describe your idea..."/> <button onClick={() => canProceed ? onComplete({idea}) : alert("Please provide a more detailed idea.")} disabled={!canProceed}>Next</button></div>;
};
const Phase2_Style: React.FC<{ onComplete: (data: any) => void }> = ({ onComplete }) => <div className="p-4 bg-gray-800 rounded">Phase 2: Style UI <button onClick={() => onComplete({})}>Next</button></div>;
const Phase3_Characters: React.FC<{ onComplete: (data: any) => void }> = ({ onComplete }) => <div className="p-4 bg-gray-800 rounded">Phase 3: Characters UI <button onClick={() => onComplete({})}>Next</button></div>;
const Phase4_Structure: React.FC<{ onComplete: (data: any) => void }> = ({ onComplete }) => <div className="p-4 bg-gray-800 rounded">Phase 4: Structure UI <button onClick={() => onComplete({})}>Next</button></div>;


interface StoryBuilderProps {
  // FIX: Corrected `existingProject` type to `ExportedProject` to resolve property access errors.
  existingProject?: ExportedProject;
  onExit: () => void;
  isExtensionConnected: boolean;
  setIsExtensionConnected: (isConnected: boolean) => void;
  openConnector: () => void;
}

const StoryBuilder: React.FC<StoryBuilderProps> = ({ existingProject, onExit, isExtensionConnected, setIsExtensionConnected, openConnector }) => {
    const [phase, setPhase] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<Record<string, ProgressUpdate>>({});

    // Story data states
    const [initialConcept, setInitialConcept] = useState<InitialConcept | null>(null);
    const [styleAndFormat, setStyleAndFormat] = useState<StyleAndFormat | null>(null);
    const [characters, setCharacters] = useState<CharacterDefinition[]>([]);
    const [storyStructure, setStoryStructure] = useState<StoryStructure | null>(null);

    // Generated assets states
    const [storyPlan, setStoryPlan] = useState<StoryMasterplan | null>(null);
    const [critique, setCritique] = useState<Critique | null>(null);
    const [documentation, setDocumentation] = useState<Documentation | null>(null);
    const [referenceAssets, setReferenceAssets] = useState<ReferenceAssets | null>(null);
    const [finalAssets, setFinalAssets] = useState<FinalAssets | null>(null);

    // Health Check
    useEffect(() => {
        let healthCheckInterval: NodeJS.Timeout;
        if (isExtensionConnected) {
            logger.log('INFO', 'StoryBuilder', 'Starting Gemini Web health checks.');
            healthCheckInterval = setInterval(async () => {
                try {
                    const isHealthy = await geminiWebService.healthCheck();
                    if (!isHealthy) {
                        logger.log('WARNING', 'StoryBuilder', 'Health check failed. Connection lost.');
                        setIsExtensionConnected(false);
                    } else {
                         logger.log('DEBUG', 'StoryBuilder', 'Health check successful.');
                    }
                } catch (err) {
                    logger.log('ERROR', 'StoryBuilder', 'Health check threw an error.', err);
                    setIsExtensionConnected(false);
                }
            }, 60000); // Check every 60 seconds
        }
        return () => {
            if (healthCheckInterval) {
                logger.log('INFO', 'StoryBuilder', 'Stopping health checks.');
                clearInterval(healthCheckInterval);
            }
        };
    }, [isExtensionConnected, setIsExtensionConnected]);
    
    const projectState = useMemo(() => ({
        phase,
        initialConcept,
        styleAndFormat,
        characters,
        storyStructure,
        storyPlan,
        critique,
        documentation,
        referenceAssets: referenceAssets ? {
          ...referenceAssets,
          // Convert assetId to a placeholder for saving, as blobs are in IndexedDB
          characters: referenceAssets.characters.map(a => ({...a, generationStatus: 'completed'} as ReferenceAsset)),
        } : null,
        finalAssets
    }), [phase, initialConcept, styleAndFormat, characters, storyStructure, storyPlan, critique, documentation, referenceAssets, finalAssets]);

    // Auto-Save Project
    useEffect(() => {
        const autoSave = setTimeout(() => {
            // Only save if we are past the initial input phases and have a plan
            if (phase >= 5 && storyPlan) {
                logger.log('DEBUG', 'StoryBuilder', 'Auto-saving project state to localStorage.');
                projectPersistenceService.saveProject(projectState);
            }
        }, 3000); // Debounce save by 3 seconds

        return () => clearTimeout(autoSave);
    }, [projectState, phase, storyPlan]);

    // Load Existing Project
    useEffect(() => {
        if (existingProject) {
            logger.log('INFO', 'StoryBuilder', 'Loading existing project.', existingProject);
            setPhase(existingProject.phase || 1);
            setInitialConcept(existingProject.initialConcept || null);
            setStyleAndFormat(existingProject.styleAndFormat || null);
            setCharacters(existingProject.characters || []);
            setStoryStructure(existingProject.storyStructure || null);
            setStoryPlan(existingProject.storyPlan || null);
            setCritique(existingProject.critique || null);
            setDocumentation(existingProject.documentation || null);
            setReferenceAssets(existingProject.referenceAssets || null);
            setFinalAssets(existingProject.finalAssets || null);
        }
    }, [existingProject]);


    const handleProgress = useCallback((update: ProgressUpdate) => {
        setProgress(prev => ({ ...prev, [update.stage]: update }));
    }, []);
    
    const runFullGenerationPipeline = async (currentPlan: StoryMasterplan) => {
        setIsLoading(true);
        setError(null);
        setProgress({});

        try {
            handleProgress({ stage: 'critique', status: 'in_progress', message: 'Generating strategic critique...' });
            const initialCritique = await critiqueStoryMasterplan(currentPlan);
            setCritique(initialCritique);
            setStoryPlan(prev => prev ? { ...prev, critique: initialCritique } : null);
            handleProgress({ stage: 'critique', status: 'complete', message: 'Critique complete.' });
            setPhase(6.1);
        } catch (e) {
            const friendlyError = formatApiError(e);
            setError(`Pipeline failed at critique phase: ${friendlyError}`);
            handleProgress({ stage: 'critique', status: 'error', message: friendlyError });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApplyImprovements = async () => {
        if (!storyPlan) return;
        setIsLoading(true);
        setError(null);
        setProgress({ apply_critique: { stage: 'apply_critique', status: 'in_progress', message: 'Applying improvements...' } });
        
        try {
            const improvedPlan = await applyCritiqueToMasterplan(storyPlan);
            setStoryPlan(improvedPlan);
            setCritique(null);
            setProgress({ apply_critique: { stage: 'apply_critique', status: 'complete', message: 'Plan improved.' } });
            await runFullGenerationPipeline(improvedPlan);
        } catch (e) {
            const friendlyError = formatApiError(e);
            setError(`Failed to apply improvements: ${friendlyError}`);
            setProgress({ apply_critique: { stage: 'apply_critique', status: 'error', message: friendlyError } });
            setIsLoading(false);
        }
    };

    const handleContinueWithoutImprovements = async () => {
         if (!storyPlan) return;
        setIsLoading(true);
        setError(null);
        setProgress({});
        
        try {
            handleProgress({ stage: 'documentation', status: 'in_progress', message: 'Generating production documents...' });
            const docs = await generateProductionBible(storyPlan);
            setDocumentation(docs);
            setStoryPlan(prev => prev ? { ...prev, documentation: docs } : null);
            handleProgress({ stage: 'documentation', status: 'complete', message: 'Documents generated.' });
            setPhase(6.2);
        } catch (e) {
            const friendlyError = formatApiError(e);
            setError(`Pipeline failed at documentation phase: ${friendlyError}`);
            handleProgress({ stage: 'documentation', status: 'error', message: friendlyError });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartReferenceGeneration = async () => {
        if (!storyPlan) return;
        if (!isExtensionConnected) {
             alert("La generación de activos de referencia requiere la conexión de 'Generación Ilimitada'. Por favor, conéctate usando la extensión de Chrome.");
             openConnector();
             return;
        }
        setIsLoading(true);
        setError(null);
        setProgress({});
        setPhase(6.3);

        try {
            handleProgress({ stage: 'reference_assets', status: 'in_progress', message: 'Generating reference assets...' });
            const assets = await generateReferenceAssets(storyPlan, handleProgress);
            setReferenceAssets(assets);
            handleProgress({ stage: 'reference_assets', status: 'complete', message: 'Reference assets complete.' });
        } catch (e) {
            const friendlyError = formatApiError(e);
            setError(`Pipeline failed at reference asset generation: ${friendlyError}`);
            handleProgress({ stage: 'reference_assets', status: 'error', message: friendlyError });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartVideoGeneration = async () => {
        if (!storyPlan || !referenceAssets) return;
        setIsLoading(true);
        setError(null);
        setFinalAssets(null);
        setProgress({});
        setPhase(6.4);
        
        try {
             const finalVideoAssets = await generateVideoAssets(storyPlan, referenceAssets, handleProgress);
             setFinalAssets(finalVideoAssets);
             setProgress(prev => ({ ...prev, complete: { stage: 'complete', status: 'complete', message: 'All video assets generated.' } }));
        } catch(e) {
            const friendlyError = formatApiError(e);
            setError(`Pipeline failed during video generation: ${friendlyError}`);
            setProgress(prev => ({ ...prev, complete: { stage: 'complete', status: 'error', message: friendlyError } }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoToPhase = (targetPhase: number) => {
        setPhase(targetPhase);
        setError(null);
    };

    const renderPhaseContent = () => {
        if (error) {
            return (
                <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg">
                    <h3 className="font-bold text-lg">Ocurrió un Error</h3>
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="mt-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded">
                        Descartar
                    </button>
                </div>
            );
        }

        switch (phase) {
            case 1: return <Phase1_Concept initialData={initialConcept} onComplete={(data) => { setInitialConcept(data); setPhase(2); }} />;
            case 2: return <Phase2_Style onComplete={(data) => { if(!styleAndFormat){alert("Please select a style."); return;} setStyleAndFormat(data); setPhase(3); }} />;
            case 3: return <Phase3_Characters onComplete={(data) => { if(characters.length === 0){alert("Please define at least one character."); return;} setCharacters(data); setPhase(4); }} />;
            case 4: return <Phase4_Structure onComplete={(data) => { setStoryStructure(data); setPhase(5); }} />;
            case 5:
                return (
                    <div className="text-center">
                        <Spinner />
                        <p className="mt-4 text-gray-400">Generating initial story masterplan...</p>
                    </div>
                );
            case 6.1:
                return <EvaluationPhaseView 
                            critique={critique} 
                            isLoading={isLoading} 
                            onApplyImprovements={handleApplyImprovements}
                            onContinue={handleContinueWithoutImprovements}
                            onGoToPhase={handleGoToPhase}
                        />;
            case 6.2:
                return <RefinementPhaseView 
                            storyPlan={storyPlan}
                            documentation={documentation}
                            onStartReferenceGeneration={handleStartReferenceGeneration}
                        />
            case 6.3:
                 return <ReferenceAssetView
                            isLoading={isLoading}
                            progress={progress}
                            assets={referenceAssets}
                            error={error}
                            storyPlan={storyPlan}
                            onRegenerate={handleStartReferenceGeneration}
                            onContinue={handleStartVideoGeneration}
                            onGoToPhase={handleGoToPhase}
                        />
            case 6.4:
                return <AssetGenerationView
                            isLoading={isLoading}
                            progress={progress}
                            assets={finalAssets}
                            error={error}
                            storyPlan={storyPlan}
                            onRegenerate={handleStartVideoGeneration}
                            onGoToPhase={handleGoToPhase}
                        />
            default:
                return <div>Fase desconocida: {phase}</div>;
        }
    };
    
    return (
        <div className="bg-gray-900 min-h-screen text-white flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-4xl">
                 <header className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <BookOpenIcon className="w-8 h-8 text-blue-400" />
                        <h1 className="text-3xl font-bold">Story Builder</h1>
                    </div>
                    <button onClick={onExit} className="text-gray-400 hover:text-white" title="Salir al menú principal">
                        <XCircleIcon className="w-8 h-8" />
                    </button>
                </header>
                
                <main className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-8 mt-4">
                    {renderPhaseContent()}
                </main>
            </div>
        </div>
    );
};

export default StoryBuilder;