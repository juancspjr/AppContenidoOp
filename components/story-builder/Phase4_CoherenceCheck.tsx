/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import type { StructuralCoherenceReport, CoherenceCheckStep } from './types';
import Spinner from '../Spinner';
import { SparkleIcon } from '../icons';

interface Phase4_CoherenceCheckProps {
    onComplete: () => void;
    onBack: () => void;
    onRunCheck: () => void;
    isChecking: boolean;
    isApplyingSuggestions: boolean;
    report: StructuralCoherenceReport | null;
    progress: CoherenceCheckStep[] | null;
    error: string | null;
    onApplySuggestions: (suggestions: StructuralCoherenceReport['checks']) => void;
}

const Phase4_CoherenceCheck: React.FC<Phase4_CoherenceCheckProps> = ({
    onComplete, onBack, onRunCheck, isChecking, report, progress, error,
    onApplySuggestions, isApplyingSuggestions
}) => {
    const [selectedChecks, setSelectedChecks] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!report && !isChecking && !error) {
            onRunCheck();
        }
    }, [report, isChecking, error, onRunCheck]);

    // Clear selections when a new report is generated
    useEffect(() => {
        setSelectedChecks(new Set());
    }, [report]);

    const handleToggleCheck = (id: string) => {
        setSelectedChecks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleApplyClick = () => {
        if (report && selectedChecks.size > 0) {
            const suggestionsToApply = report.checks.filter(c => selectedChecks.has(c.id));
            onApplySuggestions(suggestionsToApply);
        }
    };

    const getStatusIcon = (status: CoherenceCheckStep['status']) => {
        switch(status) {
            case 'pending': return '⏳';
            case 'running': return <Spinner className="w-4 h-4" />;
            case 'complete': return '✅';
            case 'error': return '❌';
            default: return '❔';
        }
    };

    const getSeverityClass = (severity: 'low' | 'medium' | 'high') => {
        switch (severity) {
            case 'low': return 'border-l-green-500';
            case 'medium': return 'border-l-yellow-500';
            case 'high': return 'border-l-red-500';
            default: return 'border-l-gray-500';
        }
    };
    
    const isLoading = isChecking || isApplyingSuggestions;

    if (error) {
        return (
             <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en el Análisis de Coherencia</h3>
                <p className="mb-4">{error}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Atrás</button>
                    <button onClick={onRunCheck} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar Análisis</button>
                </div>
            </div>
        );
    }

    if (isLoading || !report) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">
                    {isApplyingSuggestions ? 'Aplicando mejoras a la historia...' : 'Analizando Coherencia Estructural...'}
                </h3>
                <p className="text-gray-400">
                    {isApplyingSuggestions ? 'El Agente de Guion está reescribiendo las partes seleccionadas.' : 'El Agente de Guion está revisando tu historia en busca de inconsistencias.'}
                </p>
                {isChecking && !isApplyingSuggestions && (
                    <div className="mt-4 text-left max-w-md mx-auto space-y-2">
                        {progress?.map(step => (
                            <div key={step.id} className={`flex items-center gap-3 p-2 rounded-lg ${step.status === 'running' ? 'bg-blue-900/50' : 'bg-gray-900/50'}`}>
                               <div className="w-5 h-5 flex items-center justify-center">{getStatusIcon(step.status)}</div>
                               <span>{step.label}</span>
                               {step.result && <span className="ml-auto text-sm text-gray-300">{step.result}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    const scoreColor = report.coherenceScore >= 8 ? 'text-green-400' : report.coherenceScore >= 5 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 4.5: Informe de Coherencia</h2>
            <p className="text-gray-400">El análisis ha finalizado. Revisa los resultados, selecciona las sugerencias que quieras aplicar y deja que la IA refine tu historia.</p>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-center">
                <h3 className="text-lg font-semibold">Puntuación de Coherencia</h3>
                <p className={`text-6xl font-bold my-2 ${scoreColor}`}>{report.coherenceScore.toFixed(1)} <span className="text-3xl">/ 10</span></p>
                <p className="text-sm text-gray-300">{report.overallAssessment}</p>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {(report.checks || []).map(item => (
                    <div key={item.id} className={`bg-gray-800/80 p-3 rounded-lg border-l-4 flex items-start gap-3 ${getSeverityClass(item.severity)}`}>
                        <input
                            type="checkbox"
                            id={`check-${item.id}`}
                            checked={selectedChecks.has(item.id)}
                            onChange={() => handleToggleCheck(item.id)}
                            className="mt-1.5 h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`check-${item.id}`} className="flex-grow">
                            <h4 className="font-semibold text-gray-200">{item.element} <span className="text-xs font-normal text-gray-400 capitalize">({item.severity})</span></h4>
                            <p className="text-sm text-yellow-400 my-1"><strong>Problema:</strong> {item.concern}</p>
                            <p className="text-sm text-green-400"><strong>Sugerencia:</strong> {item.suggestion}</p>
                        </label>
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700">
                <button 
                    onClick={handleApplyClick}
                    disabled={isLoading || selectedChecks.size === 0}
                    className="w-full sm:w-auto flex-grow flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-not-allowed"
                >
                    <SparkleIcon className="w-5 h-5" />
                    Aplicar {selectedChecks.size} Sugerencia(s) y Re-analizar
                </button>
                <button 
                    onClick={onComplete}
                    disabled={isLoading}
                    className="w-full sm:w-auto flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    Continuar a la Generación del Plan
                </button>
            </div>
             <div className="text-center">
                <button onClick={onBack} className="text-sm text-gray-400 hover:text-white">Atrás</button>
            </div>
        </div>
    );
};

export default Phase4_CoherenceCheck;