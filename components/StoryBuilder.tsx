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
import Phase4_CoherenceCheck from './story-builder/Phase4_CoherenceCheck';
import Phase5_ReviewPlan from './story-builder/Phase5_ReviewPlan';
import EvaluationPhaseView from './story-builder/EvaluationPhaseView';
import RefinementPhaseView from './story-builder/RefinementPhaseView';
import Phase6_HookMatrix from './story-builder/Phase6_HookMatrix';
// FIX: Replaced ReferenceAssetView with the new Storyboard component for phase 6.3
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
            case 1:
                return <Phase1_Concept onComplete={actions.setConcept} initialData={state.initialConcept} onAssist={actions.assistConcept} isAssisting={state.isAssisting} />;
            case 2:
                // FIX: Pass the 'error' prop to the Phase2_Style component as it is required.
                return <Phase2_Style onComplete={actions.setStyle} initialData={state.styleAndFormat} onBack={() => actions.goToPhase(1)} onSuggest={actions.suggestStyle} isSuggesting={state.isAssisting} error={state.error} />;
            case 3:
                return <Phase3_Characters onComplete={actions.setCharacters} initialData={state.characters} onBack={() => actions.goToPhase(2)} onAssistCharacter={actions.assistCharacter} onGenerateCharacterCast={actions.generateCharacterCast} assistingCharacterIds={state.assistingCharacterIds} />;
            case 4:
                return <Phase4_Structure onComplete={actions.setStructure} initialData={state.storyStructure} onBack={() => actions.goToPhase(3)} onAssist={actions.assistStructure} isAssisting={state.isAssisting} />;
            case 4.5:
                return <Phase4_CoherenceCheck onComplete={actions.completePhaseAndAdvance} onBack={() => actions.goToPhase(4)} report={state.coherenceReport} isChecking={state.isLoading} progress={state.coherenceCheckProgress} onRunCheck={actions.runCoherenceCheck} error={state.error} onApplySuggestions={actions.applyCoherenceSuggestions} isApplyingSuggestions={state.isAssisting} />;
            case 5:
                return <Phase5_ReviewPlan onComplete={actions.completePhaseAndAdvance} onBack={() => actions.goToPhase(4)} storyPlan={state.storyPlan} isGenerating={state.isLoading} error={state.error} onGenerate={actions.generateStoryPlan} onRegenerate={actions.generateStoryPlan} />;
            case 6.1:
                return <EvaluationPhaseView critique={state.critique} critiqueStage={state.critiqueStage} isLoading={state.isLoading} error={state.error} onRefineCritique={actions.refineCritique} onApproveAndGenerateDocs={actions.approveCritiqueAndGenerateDocs} onGoToPhase={actions.goToPhase} onRegenerate={actions.runCritique} isSuggestingVirality={state.isSuggestingVirality} onGenerateViralitySuggestions={actions.generateViralitySuggestions} isApplyingImprovements={state.isApplyingImprovements} onApplyCritiqueImprovements={actions.applyCritiqueImprovements} />;
            case 6.2:
                return <RefinementPhaseView storyPlan={state.storyPlan} documentation={state.documentation} onContinue={() => actions.goToPhase(6.25)} />;
            case 6.25:
                 return <Phase6_HookMatrix isLoading={state.isLoading} hookMatrix={state.hookMatrix} storyPlan={state.storyPlan} onContinue={() => actions.goToPhase(6.3)} />;
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