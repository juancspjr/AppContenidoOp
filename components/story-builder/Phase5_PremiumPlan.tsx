/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import type { PremiumStoryPlan } from './types';
import Spinner from '../Spinner';
import { formatApiError } from '../../utils/errorUtils';

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
    // Automatically trigger generation if the plan doesn't exist yet.
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
                <p className="text-gray-400">El director de IA está sintetizando los datos de los agentes especializados.</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error al Generar el Plan</h3>
                <p className="mb-4">{formatApiError(error)}</p>
                <button onClick={onGenerate} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar</button>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 5: Plan Maestro Premium Aprobado</h2>
            <p className="text-gray-400">Revisa la versión final del plan de tu historia, enriquecido por los agentes especializados. Este plan guiará toda la producción.</p>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-blue-300">{premiumPlan.metadata.title}</h3>
                <p className="italic text-gray-300">"{premiumPlan.metadata.logline}"</p>
                
                <div className="pt-2">
                    <h4 className="font-semibold text-purple-400">Aportes de Agentes:</h4>
                    <ul className="list-disc list-inside text-sm text-gray-400">
                        {(premiumPlan.agent_contributions.psychology_insights || []).map((insight, i) => <li key={`psy-${i}`}>{insight}</li>)}
                         {(premiumPlan.agent_contributions.cultural_integrations || []).map((insight, i) => <li key={`cul-${i}`}>{insight}</li>)}
                         {(premiumPlan.agent_contributions.viral_optimizations || []).map((insight, i) => <li key={`vir-${i}`}>{insight}</li>)}
                    </ul>
                </div>
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
                    Continuar a la Documentación
                </button>
            </div>
        </div>
    );
};

export default Phase5_PremiumPlan;
