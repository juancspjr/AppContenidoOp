/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import type { PremiumStoryPlan } from './types';
import Spinner from '../Spinner';

interface Phase5_PremiumPlanProps {
    premiumPlan: PremiumStoryPlan | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void;
    onComplete: () => void;
    onBack: () => void;
}

const Phase5_PremiumPlan: React.FC<Phase5_PremiumPlanProps> = ({
    premiumPlan, isGenerating, error, onGenerate, onComplete, onBack
}) => {
    useEffect(() => {
        if (!premiumPlan && !isGenerating && !error) {
            onGenerate();
        }
    }, [premiumPlan, isGenerating, error, onGenerate]);

    if (isGenerating || !premiumPlan) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">Generando Plan Maestro Premium...</h3>
                <p className="text-gray-400">El Agente Director está sintetizando los datos enriquecidos en un plan cohesivo.</p>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 5: Revisar el Plan Maestro Premium</h2>
            <p className="text-gray-400">Este es el plan detallado que la IA ha generado, enriquecido con las contribuciones de los agentes. Si estás satisfecho, podemos generar la documentación final.</p>
             <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-blue-300">Resumen del Plan: {premiumPlan.metadata.title}</h3>
                <p><strong>Logline:</strong> {premiumPlan.metadata.logline}</p>
                <h4 className="font-semibold text-purple-400 mt-4">Contribuciones de Agentes:</h4>
                <ul className="list-disc list-inside text-sm">
                    {premiumPlan.agent_contributions.psychology_insights.map((insight, i) => <li key={i}>{insight}</li>)}
                    {premiumPlan.agent_contributions.viral_optimizations.map((opt, i) => <li key={i}>{opt}</li>)}
                </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500"
                >
                    Atrás
                </button>
                <button 
                    onClick={onComplete}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500"
                >
                    Aprobar y Generar Documentación Premium
                </button>
            </div>
        </div>
    );
};

export default Phase5_PremiumPlan;
