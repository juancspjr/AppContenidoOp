// FIX: Replaced placeholder content with a complete, functional `StoryBuilder` component.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
// FIX: Corrected import path for useStoryBuilderStateMachine to be relative.
import { useStoryBuilderStateMachine } from '../hooks/useStoryBuilderStateMachine';
import type { ExportedProject } from './story-builder/types';

import PhaseStepper from './story-builder/PhaseStepper';
import Phase1_Concept from './story-builder/Phase1_Concept';
import Phase2_Style from './story-builder/Phase2_Style';
import Phase3_Characters from './story-builder/Phase3_Characters';
import Phase4_Structure from './story-builder/Phase4_Structure';

// New Premium Flow Components
import Phase4_5_ArtisticConstruction from './story-builder/Phase4_5_ArtisticConstruction';
import Phase5_PremiumPlan from './story-builder/Phase5_PremiumPlan';
import Phase6_1_PremiumDocumentation from './story-builder/Phase6_1_PremiumDocumentation';
import Phase6_2_FinalEvaluation from './story-builder/Phase6_2_FinalEvaluation';

// Final Asset Generation Components (Unchanged)
import Phase6_Storyboard from './story-builder/Phase6_Storyboard';
import AssetGenerationView from './story-builder/AssetGenerationView';

import { XCircleIcon, DocumentIcon } from './icons';
import LogViewer from './LogViewer';

interface StoryBuilderProps {
  existingProject?: ExportedProject;
  onExit: () => void;
}

const StoryBuilder: React.FC<StoryBuilderProps> = ({ existingProject, onExit }) => {
    const { state, actions } = useStoryBuilderStateMachine(existingProject);
    const [isLogVisible, setIsLogVisible] = useState(false);

    const renderCurrentPhase = () => {
        switch (state.phase) {
            // --- Initial Setup Phases (Unchanged) ---
            case 1:
                return <Phase1_Concept onComplete={actions.setConcept} initialData={state.initialConcept} onAssist={actions.assistConcept} isAssisting={state.isAssisting} />;
            case 2:
                return <Phase2_Style onComplete={actions.setStyle} initialData={state.styleAndFormat} onBack={() => actions.goToPhase(1)} onSuggest={actions.suggestStyle} isSuggesting={state.isAssisting} error={state.error} />;
            case 3:
                return <Phase3_Characters onComplete={actions.setCharacters} initialData={state.characters} onBack={() => actions.goToPhase(2)} onAssistCharacter={actions.assistCharacter} onGenerateCharacterCast={actions.generateCharacterCast} assistingCharacterIds={state.assistingCharacterIds} />;
            case 4:
                return <Phase4_Structure onComplete={actions.setStructure} initialData={state.storyStructure} onBack={() => actions.goToPhase(3)} onAssist={actions.assistStructure} isAssisting={state.isAssisting} />;

            // --- NEW PREMIUM ARTISTIC FLOW ---
            case 4.5:
                // FIX: Pass 'enhancedData' prop and remove props not defined in the component's interface.
                return <Phase4_5_ArtisticConstruction 
                            enhancedData={state.enhancedData}
                            onComplete={() => {
                                actions.generatePremiumPlan();
                            }} 
                            onBack={() => actions.goToPhase(4)}
                            isProcessing={state.isLoading}
                            currentAgent={state.currentAgent}
                            progress={state.agentProgress}
                        />;
            case 5:
                 return <Phase5_PremiumPlan 
                            premiumPlan={state.premiumPlan}
                            isGenerating={state.isLoading}
                            error={state.error}
                            onGenerate={actions.generatePremiumPlan}
                            onComplete={actions.generatePremiumDocs}
                            onBack={() => actions.goToPhase(4.5)}
                        />;
            case 6.1:
                return <Phase6_1_PremiumDocumentation 
                            premiumDocumentation={state.premiumDocumentation}
                            isGenerating={state.isLoading}
                            error={state.error}
                            onGenerate={actions.generatePremiumDocs}
                            onComplete={actions.runFinalEvaluation}
                            onBack={() => actions.goToPhase(5)}
                        />;
            case 6.2:
                 return <Phase6_2_FinalEvaluation
                            premiumDocumentation={state.premiumDocumentation!}
                            finalEvaluation={state.finalEvaluation}
                            isEvaluating={state.isLoading}
                            onEvaluate={actions.runFinalEvaluation}
                            onComplete={() => actions.goToPhase(6.3)}
                            onBack={() => actions.goToPhase(6.1)}
                        />;
            
            // --- Final Asset Generation (Unchanged) ---
            case 6.3:
                 return <Phase6_Storyboard isLoading={state.isLoading} characterAssets={state.referenceAssets?.characters || null} storyboardAssets={state.storyboardAssets} error={state.error} storyPlan={state.storyPlan} onGenerateCharacters={actions.generateCharacterReferences} onGenerateStoryboard={actions.generateStoryboard} onRegeneratePanel={actions.regenerateStoryboardPanel} onContinue={() => actions.goToPhase(6.4)} />;
            case 6.4:
                 return <AssetGenerationView isLoading={state.isLoading} progress={state.progress} assets={state.finalAssets} storyboardAssets={state.storyboardAssets} error={state.error} storyPlan={state.storyPlan} onGenerate={actions.generateFinalAssets} onGoToPhase={actions.goToPhase} onExit={onExit} />;
            
            default:
                return <div>Fase desconocida: {state.phase}</div>;
        }
    };
    
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
            <header className="flex-shrink-0 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsLogVisible(true)} className="text-gray-400 hover:text-white transition-colors" title="Abrir Visor de Logs">
                            <DocumentIcon className="w-6 h-6"/>
                        </button>
                    </div>
                    <div className="flex-grow">
                        <PhaseStepper currentPhase={state.phase} onPhaseClick={actions.goToPhase} />
                    </div>
                    <button onClick={onExit} className="ml-4 text-gray-400 hover:text-white transition-colors">
                        <XCircleIcon className="w-8 h-8"/>
                    </button>
                </div>
            </header>
            <main className="flex-grow p-6 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {renderCurrentPhase()}
                </div>
            </main>
            <LogViewer isVisible={isLogVisible} onClose={() => setIsLogVisible(false)} />
        </div>
    );
};

export default StoryBuilder;