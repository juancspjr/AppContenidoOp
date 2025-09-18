/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { Critique } from '@/components/story-builder/types';
import Spinner from '@/components/Spinner';

interface EvaluationPhaseViewProps {
    critique: Critique | null;
    isLoading: boolean;
    onApplyImprovements: () => void;
    onContinue: () => void;
    onGoToPhase: (phase: number) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; icon?: string }> = ({ title, children, icon }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <h4 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">{icon && <span className="text-xl">{icon}</span>} {title}</h4>
        <div className="space-y-2 text-gray-300 text-sm">
            {children}
        </div>
    </div>
);

const EvaluationPhaseView: React.FC<EvaluationPhaseViewProps> = ({ critique, isLoading, onApplyImprovements, onContinue, onGoToPhase }) => {

    if (!critique) {
        return (
            <div className="text-center py-8">
                <Spinner className="animate-spin h-16 w-16 text-white mx-auto" />
                <p className="text-gray-400 mt-4">Cargando evaluación estratégica...</p>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.1: Evaluación y Estrategia</h3>
            <p className="text-gray-400 mb-6">Un agente de IA ha analizado tu plan y ha preparado un diagnóstico para optimizarlo para tu formato de salida. Revisa las sugerencias y decide cómo proceder.</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <Section title="Resumen del Proyecto" icon="🎬">
                    <p><strong>De Qué Se Trata:</strong> {critique.projectSummary?.about || 'N/A'}</p>
                    <p><strong>Elementos Clave:</strong> {(critique.projectSummary?.keyElements || []).join(', ')}</p>
                    <p><strong>Fortalezas Identificadas:</strong> {(critique.projectSummary?.identifiedStrengths || []).join(', ')}</p>
                </Section>
                
                <Section title={critique.verticalFormatEvaluation?.title || 'Evaluación de Formato Vertical'} icon="📈">
                     <div>
                        <h5 className="font-semibold text-green-400">🎯 Fortalezas Actuales:</h5>
                        <ul className="list-disc list-inside ml-2">
                            {(critique.verticalFormatEvaluation?.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-semibold text-red-400">⚠️ {critique.verticalFormatEvaluation?.weaknesses?.title || 'Debilidades'}:</h5>
                        <ul className="list-disc list-inside ml-2">
                            {(critique.verticalFormatEvaluation?.weaknesses?.points || []).map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                </Section>

                 <Section title={critique.improvementStrategy?.title || 'Estrategia de Mejora'} icon="🚀">
                    {(critique.improvementStrategy?.strategies || []).filter(Boolean).map((s, i) => (
                        <div key={i}>
                           <h5 className="font-semibold text-gray-200">{s.title}</h5>
                           <p className="text-gray-400">{s.description}</p>
                        </div>
                    ))}
                </Section>
                
                 <Section title={critique.proposedSolution?.title || 'Solución Propuesta'} icon="💡">
                    <h5 className="font-semibold text-yellow-300">{critique.proposedSolution?.solutionTitle || 'Propuesta'}</h5>
                     <ul className="list-decimal list-inside ml-2 space-y-1">
                        {(critique.proposedSolution?.episodes || []).filter(Boolean).map((ep, i) => (
                            <li key={i}><strong>{ep.title}:</strong> {ep.description}</li>
                        ))}
                    </ul>
                </Section>
                
                 <Section title={critique.implementationPlan?.title || 'Plan de Implementación'} icon="🔧">
                    <div>
                        <h5 className="font-semibold text-gray-200">Pasos Siguientes Recomendados:</h5>
                        <ul className="list-disc list-inside ml-2">
                             {(critique.implementationPlan?.nextSteps || []).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-semibold text-gray-200">Recursos Necesarios:</h5>
                        <ul className="list-disc list-inside ml-2">
                            {(critique.implementationPlan?.requiredResources || []).map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                </Section>

            </div>

            <div className="pt-6 border-t border-gray-700 mt-6 space-y-3">
                 <h4 className="text-lg font-bold text-center">¿Qué quieres hacer ahora?</h4>
                 <div className="flex flex-col sm:flex-row gap-4">
                     <button 
                        onClick={onApplyImprovements}
                        disabled={isLoading}
                        className="w-full flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:bg-green-800 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Aplicando...' : '✅ Aplicar Mejoras y Regenerar Plan'}
                    </button>
                    <button 
                        onClick={onContinue}
                        disabled={isLoading}
                        className="w-full flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors disabled:bg-gray-800"
                    >
                       ➡️ Ignorar y Continuar
                    </button>
                 </div>
                 <div className="text-center">
                    <span className="text-sm text-gray-400">o</span>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                       <button onClick={() => onGoToPhase(1)} className="text-sm text-blue-400 hover:underline">Regresar a Concepto (Fase 1)</button>
                       <button onClick={() => onGoToPhase(2)} className="text-sm text-blue-400 hover:underline">Regresar a Estilo (Fase 2)</button>
                       <button onClick={() => onGoToPhase(3)} className="text-sm text-blue-400 hover:underline">Regresar a Personajes (Fase 3)</button>
                       <button onClick={() => onGoToPhase(4)} className="text-sm text-blue-400 hover:underline">Regresar a Estructura (Fase 4)</button>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default EvaluationPhaseView;