/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { ExportedProject } from './story-builder/types';
import { useStoryBuilderStateMachine } from '../hooks/useStoryBuilderStateMachine';
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
import ReferenceAssetView from './story-builder/ReferenceAssetView';
import AssetGenerationView from './story-builder/AssetGenerationView';
import { logger } from '../utils/logger';

interface StoryBuilderProps {
    existingProject?: ExportedProject;
    onExit: () => void;
}

const StoryBuilder: React.FC<StoryBuilderProps> = ({ existingProject, onExit }) => {
    const {
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
    } = useStoryBuilderStateMachine(existingProject);

    const renderCurrentPhase = () => {
        switch (phase) {
            case 1:
                return <Phase1_Concept
                    onComplete={handlePhase1Complete}
                    initialData={initialConcept}
                    onAssist={assistConcept}
                    isAssisting={isProcessing}
                    areKeysConfigured={areKeysConfigured}
                />;
            case 2:
                return <Phase2_Style
                    onComplete={handlePhase2Complete}
                    initialData={styleAndFormat}
                    onBack={() => goToPhase(1)}
                    onSuggest={suggestStyle}
                    isSuggesting={isProcessing}
                    areKeysConfigured={areKeysConfigured}
                />;
            case 3:
                return <Phase3_Characters
                    onComplete={handlePhase3Complete}
                    initialData={characters}
                    onBack={() => goToPhase(2)}
                    onAssistCharacter={assistCharacter}
                    onAssistNewCharacter={assistNewCharacter}
                    assistingCharacterIds={assistingCharacterIds}
                    areKeysConfigured={areKeysConfigured}
                />;
            case 4:
                return <Phase4_Structure
                    onComplete={handlePhase4Complete}
                    initialData={storyStructure}
                    onBack={() => goToPhase(3)}
                    onGenerate={generateStructure}
                    isGenerating={isProcessing}
                    areKeysConfigured={areKeysConfigured}
                />;
            case 4.5:
                return <Phase4_CoherenceCheck
                    onComplete={() => setPhase(5)} // The hook handles the state, this just moves view
                    onBack={() => goToPhase(4)}
                    onRunCheck={runCoherenceAnalysis}
                    isChecking={isProcessing}
                    report={coherenceReport}
                    progress={coherenceCheckProgress}
                    error={processingError}
                 />;
            case 5:
                return <Phase5_ReviewPlan
                    onComplete={handlePhase5Complete}
                    onBack={() => goToPhase(4)}
                    storyPlan={storyPlan}
                    isGenerating={isProcessing}
                    onGenerate={generateMasterplan}
                    error={processingError}
                    onRegenerate={generateMasterplan}
                />;
            case 6.1:
                return <EvaluationPhaseView
                    critique={critique}
                    isLoading={isProcessing}
                    error={processingError}
                    onApplyImprovements={() => runCritiqueAndEnrichment(true)}
                    onContinue={handleEvaluationComplete}
                    onGoToPhase={goToPhase}
                    onRegenerate={() => runCritiqueAndEnrichment(false)}
                />;
            case 6.2:
                return <RefinementPhaseView
                    storyPlan={storyPlan}
                    documentation={documentation}
                    onStartHookMatrixGeneration={handleRefinementComplete}
                />;
            case 6.25:
                return <Phase6_HookMatrix
                    isLoading={isProcessing}
                    hookMatrix={hookMatrix}
                    storyPlan={storyPlan}
                    onContinue={handleHookMatrixComplete}
                />;
            case 6.3:
                return <ReferenceAssetView
                    isLoading={isProcessing}
                    progress={{}} // Placeholder, state machine manages this internally
                    assets={referenceAssets}
                    error={processingError}
                    storyPlan={storyPlan}
                    onRegenerateAll={generateAllReferenceAssets}
                    onRegenerateSingle={regenerateSingleReferenceAsset}
                    onGenerateSceneMatrix={generateSceneMatrix}
                    onContinue={handleReferenceAssetGenerationComplete}
                    onGoToPhase={goToPhase}
                />;
            case 6.4:
                return <AssetGenerationView
                    isLoading={isProcessing}
                    progress={{}} // Placeholder
                    assets={finalAssets}
                    referenceAssets={referenceAssets}
                    error={processingError}
                    storyPlan={storyPlan}
                    onGenerate={runFinalVideoGenerationPipeline}
                    onGoToPhase={goToPhase}
                    onExit={onExit}
                />;
            default:
                return <div>Fase desconocida: {phase}</div>;
        }
    }
    
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 font-sans">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Constructor de Historias con IA</h1>
                <button onClick={onExit} className="bg-gray-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    Salir
                </button>
            </div>
            
            <div className="mb-8">
                <PhaseStepper currentPhase={phase} />
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
                {renderCurrentPhase()}
            </div>
        </div>
    );
};

export default StoryBuilder;