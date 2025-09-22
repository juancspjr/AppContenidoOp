/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useState } from 'react';
import { BookOpenIcon, XCircleIcon } from './icons';
// FIX: Corrected relative import paths for services, hooks, and utilities to align with the project's root directory structure.
import { projectPersistenceService } from '../services/projectPersistenceService';
import { logger } from '../utils/logger';
// FIX: Corrected relative import path.
import type { ExportedProject } from './story-builder/types';
// FIX: Corrected relative import path.
import { useStoryBuilderStateMachine } from '../hooks/useStoryBuilderStateMachine';

import PhaseStepper from './story-builder/PhaseStepper';
import Spinner from './Spinner';
import Phase1_Concept from './story-builder/Phase1_Concept';
import Phase2_Style from './story-builder/Phase2_Style';
import Phase3_Characters from './story-builder/Phase3_Characters';
import Phase4_Structure from './story-builder/Phase4_Structure';
import Phase4_CoherenceCheck from './story-builder/Phase4_CoherenceCheck';
import Phase5_ReviewPlan from './story-builder/Phase5_ReviewPlan';
import Phase6_HookMatrix from './story-builder/Phase6_HookMatrix';
import EvaluationPhaseView from './story-builder/EvaluationPhaseView';
import RefinementPhaseView from './story-builder/RefinementPhaseView';
import ReferenceAssetView from './story-builder/ReferenceAssetView';
import AssetGenerationView from './story-builder/AssetGenerationView';
import APIStatusPanel from './story-builder/APIStatusPanel';
import APIKeyValidator from './story-builder/APIKeyValidator';
import GeminiWebLogin from './story-builder/GeminiWebLogin';
import HealthStatusBanner from './story-builder/HealthStatusBanner';
import geminiWebService from '../services/geminiWebService';

interface StoryBuilderProps {
  existingProject?: ExportedProject;
  onExit: () => void;
}

const StoryBuilder: React.FC<StoryBuilderProps> = ({ existingProject, onExit }) => {
    const { state, actions } = useStoryBuilderStateMachine(existingProject);
    const [isWebConnectionHealthy, setIsWebConnectionHealthy] = useState(true);
    const [showReconnectBanner, setShowReconnectBanner] = useState(false);

    // Effect for auto-saving project state
    useEffect(() => {
        const autoSave = setTimeout(() => {
            if (state.phase >= 1 && (state.initialConcept || state.styleAndFormat || state.characters.length > 0 || state.storyStructure)) {
                logger.log('DEBUG', 'StoryBuilder', 'Auto-saving project state to localStorage.');
                projectPersistenceService.saveProject(state);
            }
        }, 3000);
        return () => clearTimeout(autoSave);
    }, [state]);

    // Effect for monitoring Gemini Web Service health
    useEffect(() => {
        const checkHealth = async () => {
            const isConnected = geminiWebService.isInitialized();
            if (isConnected) {
                const healthy = await geminiWebService.healthCheck();
                setIsWebConnectionHealthy(healthy);
                if (!healthy) {
                    setShowReconnectBanner(true); // Show banner if health check fails
                }
            } else {
                setIsWebConnectionHealthy(true); // Don't show error if not even trying to connect
                setShowReconnectBanner(false);
            }
        };
        const interval = setInterval(checkHealth, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const renderPhaseContent = () => {
        const { phase, isLoading, error, progress, ...data } = state;
        
        switch (phase) {
            case 1: return <Phase1_Concept 
                                initialData={data.initialConcept} 
                                onComplete={actions.handleConceptComplete} 
                                onAssist={actions.assistConcept}
                                isAssisting={state.localLoading.concept}
                            />;
            case 2: return <Phase2_Style 
                                initialData={data.styleAndFormat} 
                                onComplete={actions.handleStyleComplete} 
                                onBack={actions.goToPhase1}
                                onSuggest={actions.suggestStyle}
                                isSuggesting={state.localLoading.style} 
                            />;
            case 3: return <Phase3_Characters 
                                initialData={data.characters} 
                                onComplete={actions.handleCharactersComplete} 
                                onBack={actions.goToPhase2}
                                onAssistCharacter={actions.assistCharacter}
                                onAssistNewCharacter={actions.assistNewCharacter}
                                assistingCharacterIds={state.localLoading.characters}
                            />;
            case 4: return <Phase4_Structure 
                                initialData={data.storyStructure} 
                                onComplete={actions.handleStructureComplete} 
                                onBack={actions.goToPhase3}
                                onGenerate={actions.generateStructure}
                                isGenerating={state.localLoading.structure}
                            />;
            case 4.5: return <Phase4_CoherenceCheck 
                                report={data.coherenceReport} 
                                progress={data.coherenceCheckProgress} 
                                isLoading={isLoading} 
                                error={error} 
                                onContinue={actions.runMasterplanGeneration} 
                                onBack={actions.goToPhase4}
                                onApplyFixes={actions.applyCoherenceFixesAndProceed}
                                onReAnalyze={actions.reAnalyzeStructure}
                             />;
            case 5:
                return (
                    <div className="text-center py-8">
                        <Spinner />
                        <p className="mt-4 text-gray-400">{progress['masterplan']?.message || 'Iniciando generación del plan maestro...'}</p>
                    </div>
                );
            case 5.1:
                return <Phase5_ReviewPlan storyPlan={data.storyPlan} onApprove={actions.runCritiqueOnly} onRegenerate={actions.runMasterplanGeneration} onPlanUpdate={actions.updateStoryPlan} />;
            case 6.1:
                return <EvaluationPhaseView critique={data.critique} isLoading={isLoading} error={error} onApplyImprovements={actions.applyImprovements} onContinue={actions.continueToDocumentation} onRegenerate={actions.runCritiqueOnly} onGoToPhase={actions.goToPhase} />;
            case 6.2:
                return <RefinementPhaseView storyPlan={data.storyPlan} documentation={data.documentation} onStartHookMatrixGeneration={actions.generateHookMatrix} />;
            case 6.25:
                return <Phase6_HookMatrix isLoading={isLoading} hookMatrix={data.hookMatrix} storyPlan={data.storyPlan} onContinue={actions.startReferenceGeneration} />;
            case 6.3:
                 return <ReferenceAssetView isLoading={isLoading} progress={progress} assets={data.referenceAssets} error={error} onRegenerateAll={actions.startReferenceGeneration} onRegenerateSingle={actions.regenerateSingleAsset} onContinue={actions.startVideoGeneration} onGoToPhase={actions.goToPhase} />;
            case 6.4:
                return <AssetGenerationView isLoading={isLoading} progress={progress} assets={data.finalAssets} error={error} storyPlan={data.storyPlan} onExit={onExit} onRegenerate={actions.startVideoGeneration} onGoToPhase={actions.goToPhase} />;
            default:
                return <div>Fase desconocida: {phase}</div>;
        }
    };
    
    return (
        <div className="bg-gray-900 min-h-screen text-white flex flex-col items-center p-4 sm:p-8">
             {showReconnectBanner && 
                <HealthStatusBanner 
                    isConnectionHealthy={isWebConnectionHealthy} 
                    onReconnect={() => {
                        // This would typically open the connection modal again.
                        // For simplicity, we just log and hide the banner.
                        logger.log('INFO', 'StoryBuilder', 'User prompted to reconnect.');
                        setShowReconnectBanner(false);
                        // A better UX would be to trigger the connection modal to open.
                    }} 
                />
            }
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
                
                <PhaseStepper currentPhase={state.phase} />

                <main className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-8 mt-4">
                    {renderPhaseContent()}
                </main>
                
                <details className="mt-6 text-sm text-gray-400">
                    <summary className="cursor-pointer hover:text-white">Paneles de Control (Debug)</summary>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <APIStatusPanel />
                        <APIKeyValidator />
                        <GeminiWebLogin />
                    </div>
                </details>

            </div>
        </div>
    );
};

export default StoryBuilder;