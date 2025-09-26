/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useMemo, useState } from 'react';
import type { EnhancedStoryData, AgentProgressStep, ProcessLog } from './types';
import Spinner from '../Spinner';

interface Phase4_5_ArtisticConstructionProps {
    onComplete: (enhancedData: EnhancedStoryData) => void;
    onBack: () => void;
    isProcessing: boolean;
    currentAgent: string;
    agentProgress: AgentProgressStep[];
    enhancedData: EnhancedStoryData | null;
    // New props for control and logging
    onStartProcessing: () => void;
    onReprocess: () => void;
    logs: ProcessLog[];
}

const Phase4_5_ArtisticConstruction: React.FC<Phase4_5_ArtisticConstructionProps> = ({
    onComplete, onBack, isProcessing, currentAgent, agentProgress, enhancedData,
    onStartProcessing, onReprocess, logs
}) => {
    const [expandedLogs, setExpandedLogs] = useState(false);
    const [selectedLogLevel, setSelectedLogLevel] = useState<'all' | 'error' | 'success' | 'debug'>('all');

    useEffect(() => {
        if (!enhancedData && !isProcessing) {
            onStartProcessing();
        }
    }, [enhancedData, isProcessing, onStartProcessing]);

    const filteredLogs = useMemo(() => {
        if (selectedLogLevel === 'all') return logs;
        return logs.filter(log => log.level.toLowerCase() === selectedLogLevel);
    }, [logs, selectedLogLevel]);
    
    const downloadLogs = () => {
        const logData = JSON.stringify(logs, null, 2);
        const blob = new Blob([logData], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `artistic-construction-logs-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isProcessing) {
        return (
            <div className="animate-fade-in space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-purple-400">Fase 4.5: Construcción Artística Premium</h2>
                    <p className="text-gray-400">Observa en tiempo real cómo nuestros agentes especializados transforman tu historia.</p>
                </div>

                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg border border-purple-500/30">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-purple-300 flex items-center gap-2">
                            <Spinner className="w-6 h-6"/>
                            {currentAgent || 'Preparando agentes...'}
                        </h3>
                    </div>
                     <div className="space-y-3 max-h-60 overflow-y-auto pr-2 bg-black/20 p-2 rounded-md">
                        {agentProgress.map((progress, index) => (
                             <div key={index} className="bg-gray-800/50 p-2 rounded">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${progress.status === 'complete' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                                        <span className="text-sm font-medium text-white">{progress.agent}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">{progress.step}/{progress.total}</span>
                                </div>
                                <p className="text-xs text-gray-300 ml-4 mt-1">{progress.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                 <div className="bg-black/30 p-4 rounded-lg border border-gray-600">
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="font-semibold text-gray-300">📋 Proceso en Tiempo Real</h3>
                         <button onClick={downloadLogs} className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-700 rounded">💾 Descargar Logs</button>
                    </div>
                     <div className="space-y-1 overflow-y-auto max-h-40 text-xs font-mono">
                        {logs.slice(-15).reverse().map((log) => (
                             <div key={log.id} className="text-gray-400">{`[${new Date(log.timestamp).toLocaleTimeString()}] [${log.component}] ${log.message}`}</div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={onBack} className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-500">← Volver</button>
                </div>
            </div>
        );
    }

    if (enhancedData) {
        return (
            <div className="animate-fade-in space-y-6">
                <div className="bg-green-900/30 p-6 rounded-lg border border-green-500/30">
                    <h3 className="text-xl font-bold text-green-400 mb-4">✨ Construcción Artística Completada</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                         {/* FIX: Correctly access properties on the `enhancedData` object. */}
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-purple-400">{enhancedData.psychological_layers?.length || 0}</div><div className="text-sm text-gray-300">Capas Psicológicas</div></div>
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-blue-400">{enhancedData.cultural_elements?.length || 0}</div><div className="text-sm text-gray-300">Elementos Culturales</div></div>
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-green-400">{enhancedData.viral_hooks?.length || 0}</div><div className="text-sm text-gray-300">Ganchos Virales</div></div>
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-yellow-400">{Math.round(enhancedData.humanization_score || 0)}%</div><div className="text-sm text-gray-300">Humanización</div></div>
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-red-400">{enhancedData.narrative_innovations?.length || 0}</div><div className="text-sm text-gray-300">Innovaciones</div></div>
                         <div className="bg-black/20 p-3 rounded text-center"><div className="text-2xl font-bold text-indigo-400">{enhancedData.historical_depth?.length || 0}</div><div className="text-sm text-gray-300">Profundidad Histórica</div></div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={onBack} className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-500">← Volver</button>
                    <button onClick={onReprocess} className="bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-500">🔄 Volver a Procesar</button>
                    <button onClick={() => onComplete(enhancedData)} className="flex-grow bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-500">Continuar a Plan Maestro Premium →</button>
                </div>
            </div>
        );
    }
    
    return (
         <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-600">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">⚠️ Construcción Artística No Iniciada</h3>
            <p className="text-gray-400 mb-4">No se han encontrado datos. Esto puede deberse a un error en el procesamiento anterior.</p>
            <div className="flex gap-4">
                <button onClick={onBack} className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-500">← Volver</button>
                <button onClick={onStartProcessing} className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-500">🚀 Iniciar Construcción</button>
            </div>
        </div>
    );
};

export default Phase4_5_ArtisticConstruction;