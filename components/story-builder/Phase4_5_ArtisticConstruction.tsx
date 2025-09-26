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
    onComplete: (enhancedData: EnhancedStoryData) => void;
    onBack: () => void;
    isProcessing: boolean;
    currentAgent: string;
    progress: AgentProgressStep[];
    enhancedData: EnhancedStoryData | null;
}

const Phase4_5_ArtisticConstruction: React.FC<Phase4_5_ArtisticConstructionProps> = ({
    onComplete, onBack, isProcessing, currentAgent, progress, enhancedData
}) => {
    
    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-purple-400">
                    Fase 4.5: Construcción Artística Premium
                </h2>
                <p className="text-gray-400">
                    Observa en tiempo real cómo nuestros agentes especializados transforman tu historia.
                </p>
            </div>

            {isProcessing ? (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-purple-300">
                                🤖 Agente Activo: {currentAgent}
                            </h3>
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {progress.map((step, index) => (
                                <div key={index} className="flex items-center gap-3 p-2 bg-black/20 rounded">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        step.status === 'complete' ? 'bg-green-500' :
                                        step.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                                        'bg-gray-500'
                                    }`} />
                                    <div className="flex-grow">
                                        <div className="text-sm text-white">{step.description}</div>
                                        <div className="text-xs text-gray-500">{new Date(step.timestamp).toLocaleTimeString()}</div>
                                    </div>
                                    {step.enhancement && (
                                        <span className="text-xs text-green-400 font-mono">
                                            {step.enhancement}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Psicología', value: enhancedData?.psychological_layers?.length || 0, color: 'purple' },
                            { label: 'Cultura', value: enhancedData?.cultural_elements?.length || 0, color: 'blue' },
                            { label: 'Historia', value: enhancedData?.historical_depth?.length || 0, color: 'green' },
                            { label: 'Viral', value: enhancedData?.viral_hooks?.length || 0, color: 'red' }
                        ].map((metric, i) => (
                            <div key={i} className="bg-black/20 p-3 rounded text-center">
                                <div className={`text-xl font-bold text-${metric.color}-400`}>
                                    {metric.value}
                                </div>
                                <div className="text-xs text-gray-400">{metric.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : enhancedData ? (
                <div className="space-y-4">
                    <div className="bg-green-900/30 p-6 rounded-lg border border-green-500/30">
                        <h3 className="text-xl font-bold text-green-400 mb-4">
                            ✨ Construcción Artística Completada
                        </h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                             <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-purple-400">
                                    {enhancedData.psychological_layers?.length || 0}
                                </div>
                                <div className="text-sm text-gray-300">Capas Psicológicas</div>
                            </div>
                            
                            <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-blue-400">
                                    {enhancedData.cultural_elements?.length || 0}
                                </div>
                                <div className="text-sm text-gray-300">Elementos Culturales</div>
                            </div>
                            
                            <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-green-400">
                                    {enhancedData.viral_hooks?.length || 0}
                                </div>
                                <div className="text-sm text-gray-300">Ganchos Virales</div>
                            </div>
                            
                            <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-yellow-400">
                                    {enhancedData.humanization_score || 0}%
                                </div>
                                <div className="text-sm text-gray-300">Humanización</div>
                            </div>
                            
                            <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-red-400">
                                    {enhancedData.narrative_innovations?.length || 0}
                                </div>
                                <div className="text-sm text-gray-300">Innovaciones</div>
                            </div>
                            
                            <div className="bg-black/20 p-4 rounded">
                                <div className="text-2xl font-bold text-indigo-400">
                                    {enhancedData.historical_depth?.length || 0}
                                </div>
                                <div className="text-sm text-gray-300">Profundidad Histórica</div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => {
                                    const orchestrator = new AgentOrchestrator();
                                    const report = orchestrator.generateProcessReport(enhancedData);
                                    const blob = new Blob([report], { type: 'text/markdown' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'reporte-construccion-artistica.md';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500"
                            >
                                📥 Descargar Reporte
                            </button>

                            <button
                                onClick={() => onComplete(enhancedData)}
                                className="w-full flex-grow bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-500"
                            >
                                Continuar a Plan Maestro Premium ➡️
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default Phase4_5_ArtisticConstruction;