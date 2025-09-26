/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import type { EnhancedStoryData } from './types';
import Spinner from '../Spinner';
import { AgentOrchestrator } from '../../services/specialized-agents/AgentOrchestrator';

interface AgentProgressStep {
    agent: string;
    step: number;
    total: number;
    description: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'complete';
    enhancement?: string;
}

interface Phase4_5_ArtisticConstructionProps {
    onComplete: () => void;
    onBack: () => void;
    isProcessing: boolean;
    currentAgent: string;
    progress: AgentProgressStep[];
    enhancedData: EnhancedStoryData | null;
}

const Phase4_5_ArtisticConstruction: React.FC<Phase4_5_ArtisticConstructionProps> = ({
    onComplete, onBack, isProcessing, currentAgent, progress, enhancedData
}) => {
    
    // This component now purely reflects the state passed down from the state machine.
    // It no longer triggers any logic itself, making it a true view layer.

    const isFinished = !isProcessing && enhancedData;

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-purple-400">
                    Fase 4.5: Construcción Artística Premium
                </h2>
                <p className="text-gray-400">
                    {isProcessing ? 'Observa en tiempo real cómo nuestros agentes especializados transforman tu historia.' : 'El proceso de mejora ha finalizado. Revisa los resultados y continúa.'}
                </p>
            </div>

            {/* Real-time Progress View */}
            {isProcessing && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg border border-purple-500/30">
                        <div className="flex items-center gap-4 mb-4">
                            <Spinner className="w-8 h-8"/>
                            <div>
                                <h3 className="text-lg font-semibold text-purple-300">
                                    🤖 Agente Activo: {currentAgent || 'Inicializando...'}
                                </h3>
                                <p className="text-sm text-gray-400">Procesando en tiempo real...</p>
                            </div>
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 bg-black/20 p-2 rounded-md">
                            {progress.map((step, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 rounded">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        step.status === 'complete' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                                    }`} />
                                    <div className="flex-grow">
                                        <div className="text-sm text-white">[{step.agent}] {step.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Final Results View */}
            {isFinished && enhancedData && (
                <div className="space-y-4">
                    <div className="bg-green-900/30 p-6 rounded-lg border border-green-500/30">
                        <h3 className="text-xl font-bold text-green-400 mb-4">
                            ✨ Construcción Artística Completada
                        </h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                             <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-purple-400">{enhancedData.psychological_layers?.length || 0}</div>
                                <div className="text-sm text-gray-300">Capas Psicológicas</div>
                            </div>
                            <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-blue-400">{enhancedData.cultural_elements?.length || 0}</div>
                                <div className="text-sm text-gray-300">Elementos Culturales</div>
                            </div>
                            <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-green-400">{enhancedData.viral_hooks?.length || 0}</div>
                                <div className="text-sm text-gray-300">Ganchos Virales</div>
                            </div>
                             <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-yellow-400">{enhancedData.humanization_score || 0}%</div>
                                <div className="text-sm text-gray-300">Humanización</div>
                            </div>
                            <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-red-400">{enhancedData.narrative_innovations?.length || 0}</div>
                                <div className="text-sm text-gray-300">Innovaciones</div>
                            </div>
                            <div className="bg-black/20 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-indigo-400">{enhancedData.historical_depth?.length || 0}</div>
                                <div className="text-sm text-gray-300">Profundidad Histórica</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button 
                    onClick={onBack}
                    disabled={isProcessing}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
                >
                    Atrás
                </button>
                <button
                    onClick={onComplete}
                    disabled={isProcessing || !enhancedData}
                    className="w-full flex-grow bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-500 transition-colors disabled:bg-purple-800 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Procesando...' : 'Continuar a Plan Maestro Premium ➡️'}
                </button>
            </div>
        </div>
    );
};

export default Phase4_5_ArtisticConstruction;