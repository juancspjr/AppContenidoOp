/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { Critique, StoryBuilderState } from './types';
import Spinner from '../Spinner';
import { safeMap } from '../../utils/safeData';
import { isWeakness, isStrategy } from '../../utils/schemaValidation';

interface EvaluationPhaseViewProps {
    critique: Critique | null;
    critiqueStage: StoryBuilderState['critiqueStage'];
    isLoading: boolean;
    error: string | null;
    onRefineCritique: (selectedStrategies: Critique['improvement_strategies'], userNotes: string) => void;
    onApproveAndGenerateDocs: () => void;
    onGoToPhase: (phase: number) => void;
    onRegenerate: () => void;
    isSuggestingVirality: boolean;
    onGenerateViralitySuggestions: () => void;
    isApplyingImprovements: boolean;
    onApplyCritiqueImprovements: () => void;
}

const ScoreDisplay: React.FC<{ score: number; label: string; color: string; isLarge?: boolean }> = ({ score, label, color, isLarge }) => (
    <div className="text-center">
        <p className={`${isLarge ? 'text-6xl' : 'text-4xl'} font-bold ${color}`}>{score.toFixed(0)}<span className="text-2xl text-gray-400">/100</span></p>
        <p className="text-sm font-semibold text-gray-300">{label}</p>
    </div>
);

const EvaluationPhaseView: React.FC<EvaluationPhaseViewProps> = ({
    critique, critiqueStage, isLoading, error, onRefineCritique, onApproveAndGenerateDocs, onGoToPhase, onRegenerate, isSuggestingVirality, onGenerateViralitySuggestions, isApplyingImprovements, onApplyCritiqueImprovements
}) => {
    const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set());
    const [userNotes, setUserNotes] = useState('');

    React.useEffect(() => {
        if (!critique && !isLoading && !error) {
            onRegenerate();
        }
    }, [critique, isLoading, error, onRegenerate]);
    
    React.useEffect(() => {
        if (critique) {
            const allStrategyIds = new Set(
                safeMap(critique.improvement_strategies, s => s.id, { guard: isStrategy })
            );
            setSelectedStrategies(allStrategyIds);
        }
    }, [critique]);
    
    const handleToggleStrategy = (strategyId: string) => {
        setSelectedStrategies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(strategyId)) {
                newSet.delete(strategyId);
            } else {
                newSet.add(strategyId);
            }
            return newSet;
        });
    };
    
    const handleRefine = () => {
        if (critique) {
            const strategiesToApply = safeMap(
                critique.improvement_strategies,
                s => s,
                { guard: (s): s is Critique['improvement_strategies'][0] => isStrategy(s) && selectedStrategies.has(s.id) }
            );
            onRefineCritique(strategiesToApply, userNotes);
        }
    };

    if (error) {
        return (
             <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error al Generar la Crítica</h3>
                <p className="mb-4">{error}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => onGoToPhase(5)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Atrás</button>
                    <button onClick={onRegenerate} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar</button>
                </div>
            </div>
        );
    }

    if (isLoading || !critique) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">
                    {isApplyingImprovements ? 'Aplicando mejoras críticas...' : 'Generando Crítica Constructiva...'}
                </h3>
                <p className="text-gray-400">
                    {isApplyingImprovements 
                        ? 'El Agente de Guion está reescribiendo el plan de historia para corregir las debilidades.' 
                        : 'El Agente Crítico está analizando tu plan de historia (Reporte α).'}
                </p>
            </div>
        );
    }

    const isBeta = critiqueStage === 'beta';
    const isBusy = isLoading || isSuggestingVirality || isApplyingImprovements;
    const hasCriticalWeaknesses = (critique.weaknesses || []).some(w => w && (w.severity === 'Moderate' || w.severity === 'High'));

    const getSeverityClass = (severity: 'Minor' | 'Moderate' | 'High') => {
        switch (severity) {
            case 'Minor': return 'border-l-green-500';
            case 'Moderate': return 'border-l-yellow-500';
            case 'High': return 'border-l-red-500';
            default: return 'border-l-gray-500';
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 6.1: Taller de Crítica ({isBeta ? 'Reporte β - Final' : 'Reporte α - Inicial'})</h2>
            <p className="text-gray-400">
                {isBeta 
                    ? "El panel ha refinado la crítica basándose en tus notas. Revisa el informe final y apruébalo para generar el dossier de producción." 
                    : "El panel de agentes ha revisado tu plan. Selecciona las mejoras a implementar, añade notas y solicita un re-análisis para obtener el informe final (β)."}
            </p>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <ScoreDisplay score={critique.integrated_score || 0} label="Puntuación Integrada" color="text-blue-400" isLarge />
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                       <ScoreDisplay score={critique.narrative_score || 0} label="Calidad Narrativa" color="text-green-400" />
                       <ScoreDisplay score={critique.viral_score || 0} label="Potencial Viral" color="text-yellow-400" />
                    </div>
                </div>

                <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
                    <h4 className="font-bold text-green-300 mb-2">✅ Fortalezas</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                        {safeMap(critique.strengths, (item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
                
                <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-500/30">
                    <h4 className="font-bold text-purple-300 mb-2">🔥 Momentos Virales Identificados</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                        {safeMap(critique.viral_moments, (item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>

                <div className="bg-red-900/30 p-4 rounded-lg border border-red-500/30">
                    <h4 className="font-bold text-red-300 mb-2">🚨 Debilidades Identificadas</h4>
                     <div className="space-y-2">
                        {safeMap(critique.weaknesses, (item, index) => (
                             <div key={index} className={`p-3 rounded-lg border-l-4 bg-black/20 ${getSeverityClass(item.severity)}`}>
                                <p className="font-semibold text-red-200">{item.point} <span className="text-xs font-normal text-gray-400">({item.severity})</span></p>
                                <p className="text-sm text-green-300 mt-1"><strong>Sugerencia:</strong> {item.suggestion}</p>
                            </div>
                        ), { guard: isWeakness })}
                    </div>
                </div>
                
                <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
                    <h4 className="font-bold text-blue-300 mb-2">💡 Estrategias de Mejora Sugeridas</h4>
                    <p className="text-xs text-blue-200/80 mb-3">Selecciona las estrategias que quieres que la IA aplique en el re-análisis.</p>
                     <div className="space-y-2">
                        {safeMap(critique.improvement_strategies, (item) => (
                             <label key={item.id} htmlFor={`strategy-${item.id}`} className="flex items-start gap-3 bg-black/20 p-3 rounded-lg cursor-pointer hover:bg-black/40">
                                <input
                                    type="checkbox"
                                    id={`strategy-${item.id}`}
                                    checked={selectedStrategies.has(item.id)}
                                    onChange={() => handleToggleStrategy(item.id)}
                                    className="mt-1 h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                    disabled={isBeta}
                                />
                                <div>
                                    <p className="font-semibold text-blue-200">{item.title}</p>
                                    <p className="text-sm text-gray-300">{item.description}</p>
                                </div>
                            </label>
                        ), { guard: isStrategy })}
                    </div>
                </div>

                 <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                     <label htmlFor="user-notes" className="font-bold text-gray-200">Notas Adicionales de Dirección</label>
                     <p className="text-xs text-gray-400 mb-2">Añade instrucciones para guiar a la IA en el re-análisis.</p>
                     <textarea
                        id="user-notes"
                        value={userNotes}
                        onChange={(e) => setUserNotes(e.target.value)}
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm"
                        placeholder="Ej: 'Quiero que el tono sea más oscuro', 'Enfócate en el tema del sacrificio del protagonista'."
                        disabled={isBeta}
                     />
                 </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                 {isBeta ? (
                    <button 
                        onClick={onApproveAndGenerateDocs}
                        disabled={isLoading}
                        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 disabled:opacity-50"
                    >
                        Aprobar Crítica y Generar Documentos ➡️
                    </button>
                 ) : (
                    <>
                        <button
                            onClick={onGenerateViralitySuggestions}
                            disabled={isBusy}
                            className="w-full sm:w-auto bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-500 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSuggestingVirality ? <Spinner className="w-5 h-5"/> : '🔄'}
                            {isSuggestingVirality ? 'Buscando...' : 'Generar Sugerencias de Viralidad'}
                        </button>
                        <button
                            onClick={onApplyCritiqueImprovements}
                            disabled={isBusy || !hasCriticalWeaknesses}
                            title={!hasCriticalWeaknesses ? "No hay debilidades críticas que aplicar." : "La IA reescribirá el plan para corregir las debilidades más importantes."}
                            className="w-full sm:w-auto bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isApplyingImprovements ? <Spinner className="w-5 h-5"/> : '🤖'}
                            {isApplyingImprovements ? 'Aplicando...' : 'Aplicar Mejoras Críticas con IA'}
                        </button>
                        <button 
                            onClick={handleRefine}
                            disabled={isBusy}
                            className="w-full flex-grow bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-500 disabled:opacity-50"
                        >
                            ♻️ Re-Analizar Completo (Reporte β)
                        </button>
                    </>
                 )}
            </div>
        </div>
    );
};

export default EvaluationPhaseView;