/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import type { PremiumDocumentation } from './types';
import Spinner from '../Spinner';

interface FinalEvaluation {
    overall_score: number;
    coherence_score: number;
    artistic_quality_score: number;
    viral_potential_score: number;
    human_authenticity_score: number;
}

interface Phase6_2_FinalEvaluationProps {
    premiumDocumentation: PremiumDocumentation;
    finalEvaluation: FinalEvaluation | null;
    isEvaluating: boolean;
    onEvaluate: () => void;
    onComplete: () => void;
    onBack: () => void;
}

const Phase6_2_FinalEvaluation: React.FC<Phase6_2_FinalEvaluationProps> = ({
    premiumDocumentation, finalEvaluation, isEvaluating, onEvaluate, onComplete, onBack
}) => {
     useEffect(() => {
        if (!finalEvaluation && !isEvaluating) {
            onEvaluate();
        }
    }, [finalEvaluation, isEvaluating, onEvaluate]);

    if (isEvaluating || !finalEvaluation) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">Realizando Evaluación Final Holística...</h3>
                <p className="text-gray-400">El panel de críticos está analizando la obra completa.</p>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-yellow-400">Fase 6.2: Evaluación Final de Obra Completa</h2>
            <p className="text-gray-400">Análisis integral de la coherencia narrativa, calidad artística, potencial viral y autenticidad humana de tu obra terminada.</p>
            
            <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 text-center">
                 <h3 className="text-lg font-semibold">Puntuación Final de la Obra</h3>
                <p className={`text-6xl font-bold my-2 text-yellow-400`}>{finalEvaluation.overall_score.toFixed(1)} <span className="text-3xl">/ 10</span></p>
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
                    className="w-full flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500"
                >
                    Aprobar y Continuar a Producción de Activos
                </button>
            </div>
        </div>
    );
};

export default Phase6_2_FinalEvaluation;
