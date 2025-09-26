/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import type { PremiumDocumentation } from './types';
import Spinner from '../Spinner';

interface Phase6_1_PremiumDocumentationProps {
    premiumDocumentation: PremiumDocumentation | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void;
    onComplete: () => void;
    onBack: () => void;
}

const Phase6_1_PremiumDocumentation: React.FC<Phase6_1_PremiumDocumentationProps> = ({
    premiumDocumentation, isGenerating, error, onGenerate, onComplete, onBack
}) => {
    useEffect(() => {
        if (!premiumDocumentation && !isGenerating && !error) {
            onGenerate();
        }
    }, [premiumDocumentation, isGenerating, error, onGenerate]);

    if (isGenerating || !premiumDocumentation) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">Generando Documentación Premium...</h3>
                <p className="text-gray-400">El equipo de producción de IA está redactando el dossier final de la obra.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 6.1: Dossier de Producción Premium</h2>
            <p className="text-gray-400">El dossier completo de tu obra, con la calidad y profundidad de los agentes especializados. Revísalo antes de la evaluación final.</p>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-lg font-bold text-blue-300">Contenido del Dossier</h3>
                <p><strong>README:</strong> {premiumDocumentation.readme.substring(0, 100)}...</p>
                 <h4 className="font-semibold text-purple-400 mt-4">Certificaciones de Calidad:</h4>
                <ul className="list-disc list-inside text-sm">
                   <li>Puntuación de Semejanza Humana: {premiumDocumentation.quality_certifications.human_likeness_score.toFixed(2)}/10</li>
                   <li>Potencial Viral Estimado: {premiumDocumentation.quality_certifications.viral_potential_score.toFixed(2)}/10</li>
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
                    Continuar a la Evaluación Final
                </button>
            </div>
        </div>
    );
};

export default Phase6_1_PremiumDocumentation;
