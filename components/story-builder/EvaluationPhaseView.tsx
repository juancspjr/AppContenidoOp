/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { Critique } from './types';
import Spinner from '../Spinner';

// Props for the main component
interface EvaluationPhaseViewProps {
    critique: Critique | null;
    isLoading: boolean;
    error: string | null;
    onApplyImprovements: () => void;
    onContinue: () => void;
    onGoToPhase: (phase: number) => void;
    onRegenerate: () => void;
}

// Helper component for consistent section styling
const Section: React.FC<{ title: string; children: React.ReactNode; icon?: string }> = ({ title, children, icon }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <h4 className="text-lg font-bold text-blue-300 mb-3 flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>} {title}
        </h4>
        <div className="space-y-2 text-gray-300 text-sm">
            {children}
        </div>
    </div>
);

// Helper component for collapsible enriched elements. Moved outside for better practice.
const EnrichedElement: React.FC<{ title: string; items?: any[] }> = ({ title, items }) => {
    if (!items || items.length === 0) return null;
    return (
        <details className="bg-gray-800/50 p-2 rounded-md cursor-pointer hover:bg-gray-800">
            <summary className="font-semibold">{title}</summary>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                {items.map((item, i) => {
                    const name = item?.name || item?.type || item?.beat || item?.element || item?.spec || 'Item';
                    const enhancements = Array.isArray(item?.enhancements) ? item.enhancements.join(', ') : 'N/A';
                    return <li key={i}><strong>{name}:</strong> {enhancements}</li>;
                })}
            </ul>
        </details>
    );
};


const EvaluationPhaseView: React.FC<EvaluationPhaseViewProps> = ({ critique, isLoading, error, onApplyImprovements, onContinue, onGoToPhase, onRegenerate }) => {

    if (error && !isLoading) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en la Fase de Evaluación</h3>
                <p className="mb-4">{error}</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={onRegenerate} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar</button>
                    <button onClick={onContinue} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Saltar y Continuar sin Mejoras</button>
                </div>
            </div>
        );
    }
    
    // Loading state display
    if (!critique || isLoading) {
        return (
            <div className="text-center py-8">
                <Spinner className="animate-spin h-16 w-16 text-white mx-auto" />
                <p className="text-gray-400 mt-4">El Estratega de IA está analizando tu plan...</p>
            </div>
        );
    }
    
    // Calculate color for viral potential score
    const viralPotential = critique.viralPotential || 0;
    const viralPotentialColor = viralPotential >= 8 ? 'text-green-400' : viralPotential >= 5 ? 'text-yellow-400' : 'text-red-400';
    
    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.1: Evaluación y Estrategia</h3>
            <p className="text-gray-400 mb-6">Un agente de IA ha analizado tu plan y ha preparado un diagnóstico para optimizarlo. Revisa las sugerencias y decide cómo proceder.</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Puntos Fuertes" icon="👍">
                        {Array.isArray(critique.narrativeStrengths) && critique.narrativeStrengths.length > 0 ? (
                            <ul className="list-disc list-inside ml-2">
                                {critique.narrativeStrengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        ) : (
                            <p>No se identificaron puntos fuertes específicos.</p>
                        )}
                    </Section>
                    <Section title="Potencial Viral" icon="📈">
                        <div className="text-center">
                            <p className={`text-5xl font-bold ${viralPotentialColor}`}>{viralPotential.toFixed(1)}<span className="text-2xl">/10</span></p>
                            <p className="text-gray-400 mt-2">Puntuación estimada por la IA.</p>
                        </div>
                    </Section>
                </div>

                <Section title="Debilidades y Sugerencias" icon="⚠️">
                    {Array.isArray(critique.weaknesses) && critique.weaknesses.length > 0 ? (
                        <ul className="space-y-3">
                            {critique.weaknesses.map((w, i) => (
                                <li key={i} className="bg-gray-800/50 p-2 rounded-md">
                                    <p className="font-semibold text-red-400">{w?.point}</p>
                                    <p className="text-gray-300 pl-2 border-l-2 border-green-400/30 mt-1"><strong>Sugerencia:</strong> {w?.suggestion}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No se identificaron debilidades.</p>
                    )}
                </Section>

                <Section title="Estrategias de Mejora" icon="🚀">
                     {Array.isArray(critique.improvementStrategies) && critique.improvementStrategies.length > 0 ? (
                        critique.improvementStrategies.map((s, i) => (
                            <div key={i} className="mb-2">
                               <h5 className="font-semibold text-gray-200">{s?.title}</h5>
                               <p className="text-gray-400">{s?.description}</p>
                            </div>
                        ))
                     ) : (
                        <p>No hay estrategias de mejora sugeridas.</p>
                     )}
                </Section>

                <Section title="Elementos Enriquecidos Sugeridos" icon="✨">
                    <p className="text-gray-400 mb-3">La IA ha propuesto mejoras específicas para cada aspecto de tu historia:</p>
                    <div className="space-y-2">
                       <EnrichedElement title="Personajes" items={critique.enrichedElements?.characters} />
                       <EnrichedElement title="Acciones" items={critique.enrichedElements?.actions} />
                       <EnrichedElement title="Ambientes" items={critique.enrichedElements?.environments} />
                       <EnrichedElement title="Narrativa" items={critique.enrichedElements?.narratives} />
                       <EnrichedElement title="Visuales" items={critique.enrichedElements?.visuals} />
                       <EnrichedElement title="Aspectos Técnicos" items={critique.enrichedElements?.technicals} />
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