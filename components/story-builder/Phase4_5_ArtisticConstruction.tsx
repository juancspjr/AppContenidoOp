/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StoryStructure, InitialConcept, StyleAndFormat, CharacterDefinition, EnhancedStoryData } from './types';
import Spinner from '../Spinner';

interface AgentProgress {
    status: 'pending' | 'processing' | 'complete';
    description: string;
    enhancement?: string;
}

interface Phase4_5_ArtisticConstructionProps {
    storyStructure: StoryStructure;
    initialConcept: InitialConcept;
    styleAndFormat: StyleAndFormat;
    characters: CharacterDefinition[];
    onComplete: (enhancedData: EnhancedStoryData) => void;
    onBack: () => void;
    isProcessing: boolean;
    currentAgent: string;
    progress: AgentProgress[];
}

const Phase4_5_ArtisticConstruction: React.FC<Phase4_5_ArtisticConstructionProps> = ({
    onComplete, onBack, isProcessing, currentAgent, progress,
}) => {
    // This is a placeholder for the actual enhanced data which will be managed by the state machine.
    // The button to continue will be enabled by the parent component once `isProcessing` is false.
    const enhancedData: EnhancedStoryData | null = !isProcessing ? ({} as EnhancedStoryData) : null;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-purple-400">
                    Fase 4.5: Construcción Artística Premium
                </h2>
                <p className="text-gray-400">
                    Nuestros agentes especializados están transformando tu historia en una obra de arte 
                    con profundidad psicológica, riqueza cultural e innovación narrativa.
                </p>
            </div>

            {isProcessing ? (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg text-center">
                       <Spinner/>
                        <h3 className="text-lg font-semibold mt-4">
                            🎨 Agente Activo: {currentAgent || 'Inicializando...'}
                        </h3>
                         <div className="mt-2 text-sm text-gray-300">
                            {progress.length > 0 ? progress[progress.length - 1].description : 'Preparando el pipeline de agentes...'}
                        </div>
                    </div>
                </div>
            ) : enhancedData ? (
                <div className="space-y-4">
                    <div className="bg-green-900/30 p-6 rounded-lg border border-green-500/30 text-center">
                        <h3 className="text-xl font-bold text-green-400 mb-4">
                            ✨ Construcción Artística Completada
                        </h3>
                        <p className="text-gray-300 mb-6">La estructura base ha sido enriquecida con múltiples capas de profundidad. La historia ahora está lista para ser ensamblada en un Plan Maestro Premium.</p>
                        <button
                            onClick={() => onComplete(enhancedData)}
                            className="w-full max-w-xs bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-500"
                        >
                            Continuar a Plan Maestro Premium ➡️
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={onBack}
                            className="text-sm text-gray-400 hover:text-white"
                        >
                            Atrás a la Estructura
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Phase4_5_ArtisticConstruction;