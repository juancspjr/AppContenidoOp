/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { StructuralCoherenceReport, CoherenceCheckStep, CoherenceCheckItem } from './types';
import Spinner from '../Spinner';
import { ExportIcon } from '../icons';
import { projectPersistenceService } from '../../services/projectPersistenceService';

interface Phase4_CoherenceCheckProps {
    report: StructuralCoherenceReport | null;
    progress: CoherenceCheckStep[] | null;
    isLoading: boolean;
    error: string | null;
    onContinue: () => void;
    onBack: () => void;
    onApplyFixes: (selectedChecks: CoherenceCheckItem[]) => void;
    onReAnalyze: () => void;
}

const severityTooltips: Record<'low' | 'medium' | 'high', string> = {
    low: 'Sugerencia menor o estilística. Puede mejorar la historia pero no es crítica.',
    medium: 'Problema de coherencia moderado. Podría confundir al público o debilitar la trama.',
    high: 'Error crítico de lógica, trama o personaje. Ignorarlo probablemente romperá la historia.',
};

const SeverityIndicator: React.FC<{ severity: 'low' | 'medium' | 'high' }> = ({ severity }) => {
    const config = {
        low: { text: 'Baja', color: 'bg-green-500' },
        medium: { text: 'Media', color: 'bg-yellow-500' },
        high: { text: 'Alta', color: 'bg-red-500' },
    }[severity];
    return <span title={severityTooltips[severity]} className={`px-2 py-0.5 text-xs rounded-full text-white ${config.color}`}>{config.text}</span>;
};

const ProgressLogItem: React.FC<{ step: CoherenceCheckStep }> = ({ step }) => {
    const getStatusIcon = () => {
        switch (step.status) {
            case 'pending': return '⏳';
            case 'running': return <Spinner className="w-4 h-4" />;
            case 'complete': return '✅';
            case 'error': return '❌';
        }
    };
    
    return (
        <div className={`p-2 rounded-md flex items-center gap-3 text-sm transition-all duration-300 ${step.status === 'running' ? 'bg-blue-900/50' : 'bg-gray-900/50'}`}>
            <div className="w-5 h-5 flex items-center justify-center">{getStatusIcon()}</div>
            <span className="flex-grow font-semibold text-gray-300">{step.label}</span>
            {step.status === 'complete' && <span className="text-green-400">{step.result}</span>}
            {step.status === 'error' && <span className="text-red-400 truncate" title={step.error}>Error</span>}
        </div>
    );
};


const Phase4_CoherenceCheck: React.FC<Phase4_CoherenceCheckProps> = ({ report, progress, isLoading, error, onContinue, onBack, onApplyFixes, onReAnalyze }) => {
    const [selectedCheckIds, setSelectedCheckIds] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);

    const handleToggleCheck = (checkId: string) => {
        setSelectedCheckIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(checkId)) {
                newSet.delete(checkId);
            } else {
                newSet.add(checkId);
            }
            return newSet;
        });
    };
    
    const handleApplyFixes = () => {
        if (!report) return;
        const selectedChecks = report.checks.filter(c => selectedCheckIds.has(c.id));
        onApplyFixes(selectedChecks);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await projectPersistenceService.exportProjectWithAssets();
        } catch(e) {
            alert(`Error exportando el proyecto: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsExporting(false);
        }
    }


    if (isLoading) {
        return (
            <div className="animate-fade-in space-y-6">
                 <h2 className="text-2xl font-bold text-blue-300">Fase 4.5: Análisis de Integridad Estructural</h2>
                 <p className="text-gray-400">Nuestros micro-agentes de IA están analizando tu historia en paralelo. Este proceso es más rápido y robusto.</p>
                 <div className="bg-black/20 p-4 rounded-lg border border-gray-700 space-y-2">
                    {progress ? (
                        progress.map(step => <ProgressLogItem key={step.id} step={step} />)
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-gray-400">
                           <Spinner className="w-5 h-5" />
                           <span>Iniciando análisis...</span>
                        </div>
                    )}
                 </div>
                 <div className="pt-6 border-t border-gray-700 mt-6 flex flex-col sm:flex-row gap-4">
                     <button disabled className="w-full sm:w-auto flex-grow bg-gray-700 text-white font-bold py-3 rounded-lg cursor-not-allowed">⬅️ Volver y Editar</button>
                     <button disabled className="w-full sm:w-auto flex-grow bg-green-800 text-white font-bold py-3 rounded-lg cursor-not-allowed">Generar Plan Maestro ➡️</button>
                 </div>
            </div>
        );
    }
    
    if (error && !report) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en el Análisis de Coherencia</h3>
                <p className="mb-4">{error}</p>
                 <div className="bg-black/20 p-4 rounded-lg border border-gray-700 space-y-2 text-left mb-4">
                    <h4 className="font-bold text-white">Progreso del Análisis:</h4>
                    {progress?.map(step => <ProgressLogItem key={step.id} step={step} />)}
                 </div>
                <div className="flex justify-center gap-4">
                     <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Volver a Estructura</button>
                    <button onClick={onContinue} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Saltar Análisis y Continuar</button>
                </div>
            </div>
        )
    }

    if (!report) {
        return (
            <div className="text-center p-4">
                 <p className="text-yellow-400">El análisis se completó pero no se generó ningún informe. Puedes volver o continuar.</p>
                  <div className="flex justify-center gap-4 mt-4">
                     <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Volver</button>
                    <button onClick={onContinue} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg">Continuar</button>
                </div>
            </div>
        );
    }

    const score = report.coherenceScore;
    const scoreColor = typeof score === 'number'
        ? (score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400')
        : 'text-gray-400';

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 4.5: Informe de Integridad Estructural</h2>
            <p className="text-gray-400">El Agente de IA ha realizado un análisis de coherencia. Selecciona las sugerencias que quieras aplicar para fortalecer tu historia.</p>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-center md:text-left">
                        <h3 className="font-bold text-lg">Evaluación General</h3>
                        <p className="text-gray-300">{report.overallAssessment}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-400">Puntuación de Coherencia</p>
                        <p className={`text-5xl font-bold ${scoreColor}`}>
                            {typeof score === 'number' ? score.toFixed(1) : 'N/A'}
                            <span className="text-2xl">/10</span>
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                {report.checks.map((item, index) => (
                    <div key={item.id} className="bg-gray-800/80 p-3 rounded-lg flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={selectedCheckIds.has(item.id)}
                            onChange={() => handleToggleCheck(item.id)}
                            className="mt-1 h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1">
                                <h4 className="font-bold text-yellow-300">{item.element}</h4>
                                <SeverityIndicator severity={item.severity} />
                            </div>
                            <p className="text-sm text-gray-300"><strong className="text-gray-400">Preocupación:</strong> {item.concern}</p>
                            <p className="text-sm text-gray-300 mt-1"><strong className="text-green-400">Sugerencia:</strong> {item.suggestion}</p>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="pt-6 border-t border-gray-700 mt-6 space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={onBack}
                        className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors"
                    >
                        ⬅️ Volver y Editar Manualmente
                    </button>
                    <button 
                        onClick={handleApplyFixes}
                        disabled={selectedCheckIds.size === 0}
                        className="w-full sm:w-auto flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                    >
                       {`✅ Aplicar ${selectedCheckIds.size} Mejoras y Continuar`}
                    </button>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-4">
                     <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 flex-grow bg-gray-700 text-white font-bold py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        <ExportIcon className="w-5 h-5"/>
                        {isExporting ? 'Exportando...' : 'Exportar Avance (.zip)'}
                    </button>
                    <button 
                        onClick={onReAnalyze}
                        className="w-full sm:w-auto flex-grow bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-500 transition-colors"
                    >
                       🔄 Re-Analizar Estructura
                    </button>
                    <button 
                        onClick={onContinue}
                        className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-500 transition-colors"
                    >
                       Ignorar y Generar Plan ➡️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Phase4_CoherenceCheck;
