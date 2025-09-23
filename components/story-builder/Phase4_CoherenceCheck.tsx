/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import type { StructuralCoherenceReport, CoherenceCheckStep } from './types';
import Spinner from '../Spinner';

interface Phase4_CoherenceCheckProps {
    onComplete: () => void;
    onBack: () => void;
    onRunCheck: () => void;
    isChecking: boolean;
    report: StructuralCoherenceReport | null;
    progress: CoherenceCheckStep[] | null;
    error: string | null;
}

const Phase4_CoherenceCheck: React.FC<Phase4_CoherenceCheckProps> = ({
    onComplete, onBack, onRunCheck, isChecking, report, progress, error
}) => {
    useEffect(() => {
        if (!report && !isChecking && !error) {
            onRunCheck();
        }
    }, [report, isChecking, error, onRunCheck]);

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

    if (isChecking || !report) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">Analizando Coherencia Estructural...</h3>
                <p className="text-gray-400">El Agente de Guion está revisando tu historia en busca de inconsistencias.</p>
                <div className="mt-4 text-left max-w-md mx-auto space-y-2">
                    {progress?.map(step => (
                        <div key={step.id} className={`flex items-center gap-3 p-2 rounded-lg ${step.status === 'running' ? 'bg-blue-900/50' : 'bg-gray-900/50'}`}>
                           <div className="w-5 h-5 flex items-center justify-center">{getStatusIcon(step.status)}</div>
                           <span>{step.label}</span>
                           {step.result && <span className="ml-auto text-sm text-gray-300">{step.result}</span>}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    const scoreColor = report.coherenceScore >= 8 ? 'text-green-400' : report.coherenceScore >= 5 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 4.5: Informe de Coherencia</h2>
            <p className="text-gray-400">El análisis ha finalizado. Revisa los resultados antes de generar el plan maestro de la IA.</p>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 text-center">
                <h3 className="text-lg font-semibold">Puntuación de Coherencia</h3>
                <p className={`text-6xl font-bold my-2 ${scoreColor}`}>{report.coherenceScore.toFixed(1)} <span className="text-3xl">/ 10</span></p>
                <p className="text-sm text-gray-300">{report.overallAssessment}</p>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {report.checks.map(item => (
                    <div key={item.id} className={`bg-gray-800/80 p-3 rounded-lg border-l-4 ${getSeverityClass(item.severity)}`}>
                        <h4 className="font-semibold text-gray-200">{item.element} <span className="text-xs font-normal text-gray-400 capitalize">({item.severity})</span></h4>
                        <p className="text-sm text-red-400 my-1"><strong>Problema:</strong> {item.concern}</p>
                        <p className="text-sm text-green-400"><strong>Sugerencia:</strong> {item.suggestion}</p>
                    </div>
                ))}
            </div>

             <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors"
                >
                    Atrás
                </button>
                <button 
                    onClick={onComplete}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors"
                >
                    Continuar a la Generación del Plan de IA
                </button>
            </div>
        </div>
    );
};

export default Phase4_CoherenceCheck;
