/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { StoryMasterplan, HookMatrix, HookTemplate } from './types';
import Spinner from '../Spinner';

interface Phase6_HookMatrixProps {
    isLoading: boolean;
    hookMatrix: HookMatrix | null;
    storyPlan: StoryMasterplan | null;
    onContinue: () => void;
}

type HookCategory = keyof HookMatrix;

const categoryInfo: Record<HookCategory, { title: string, description: string, icon: string }> = {
    patternInterrupts: { title: "Interrupciones de Patrón", description: "Ganchos diseñados para romper el scroll con un estímulo visual o auditivo inesperado.", icon: "⚡️" },
    psychologicalTriggers: { title: "Desencadenantes Psicológicos", description: "Usan sesgos cognitivos (como la prueba social o la aversión a la pérdida) para motivar la interacción.", icon: "🧠" },
    curiosityGaps: { title: "Brechas de Curiosidad", description: "Crean un vacío de información que el espectador siente la necesidad de llenar, manteniéndolo enganchado.", icon: "❓" },
    powerPhrases: { title: "Frases de Poder", description: "Declaraciones audaces o llamadas a la acción directas que provocan una respuesta emocional o una acción.", icon: "🗣️" },
    provenStructures: { title: "Estructuras Probadas", description: "Adaptaciones de fórmulas de ganchos virales conocidas, personalizadas para tu historia.", icon: "📈" },
};

const HookCategoryView: React.FC<{ category: HookCategory, templates: HookTemplate[] }> = ({ category, templates }) => {
    const info = categoryInfo[category];
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
            <h4 className="text-lg font-bold text-blue-300 mb-2">{info.icon} {info.title}</h4>
            <p className="text-sm text-gray-400 mb-4">{info.description}</p>
            <div className="space-y-3">
                {templates.map((hook, index) => (
                    <div key={index} className="bg-gray-800/50 p-3 rounded-md border-l-2 border-blue-400/50">
                        <p className="font-semibold text-gray-200">"{hook.template}"</p>
                        <p className="text-xs text-gray-400 mt-1"><strong className="text-yellow-400">Razón:</strong> {hook.rationale}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};


const Phase6_HookMatrix: React.FC<Phase6_HookMatrixProps> = ({ isLoading, hookMatrix, storyPlan, onContinue }) => {

    if (isLoading || !hookMatrix) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="mt-4 text-gray-400">El Agente "Scroll-Stopper" está creando tu matriz de ganchos virales...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 6.2.5: Matriz de Ganchos "Scroll-Stopper"</h2>
            <p className="text-gray-400">El agente de IA ha analizado tu historia "{storyPlan?.metadata?.title}" y ha generado 50 ganchos potenciales para maximizar su impacto en redes sociales. Úsalos como inspiración para tus primeros segundos de video.</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <HookCategoryView category="patternInterrupts" templates={hookMatrix.patternInterrupts} />
                <HookCategoryView category="psychologicalTriggers" templates={hookMatrix.psychologicalTriggers} />
                <HookCategoryView category="curiosityGaps" templates={hookMatrix.curiosityGaps} />
                <HookCategoryView category="powerPhrases" templates={hookMatrix.powerPhrases} />
                <HookCategoryView category="provenStructures" templates={hookMatrix.provenStructures} />
            </div>

             <div className="pt-6 border-t border-gray-700 mt-6">
                <button 
                    onClick={onContinue}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                >
                    Continuar a la Generación de Activos de Referencia ➡️
                </button>
            </div>
        </div>
    );
};

export default Phase6_HookMatrix;