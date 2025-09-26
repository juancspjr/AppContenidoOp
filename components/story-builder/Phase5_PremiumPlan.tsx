/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import type { PremiumStoryPlan } from './types';
import Spinner from '../Spinner';
import { MetricsOptimizationPanel } from './MetricsOptimizationPanel';
import { optimizeStoryMetrics } from '../../services/metricsOptimizer';
import { logger } from '../../utils/logger';
import { formatApiError } from '../../utils/errorUtils';

interface Phase5_PremiumPlanProps {
    premiumPlan: PremiumStoryPlan | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void;
    onComplete: (finalPlan: PremiumStoryPlan) => void;
    onBack: () => void;
    // New props for optimization
    isOptimizing: boolean;
    onUpdatePlan: (updatedPlan: PremiumStoryPlan) => void;
}

const Phase5_PremiumPlan: React.FC<Phase5_PremiumPlanProps> = ({
    premiumPlan, isGenerating, error, onGenerate, onComplete, onBack,
    isOptimizing, onUpdatePlan
}) => {
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (!premiumPlan && !isGenerating && !error) {
            onGenerate();
        }
    }, [premiumPlan, isGenerating, error, onGenerate]);
    
    const handleOptimizeMetrics = async (selectedImprovements: any[]) => {
        if (!premiumPlan) return;
        try {
            const optimizedPlan = await optimizeStoryMetrics(premiumPlan, selectedImprovements);
            onUpdatePlan(optimizedPlan);
            logger.log('SUCCESS', 'Phase5', 'Métricas optimizadas exitosamente.');
        } catch(err) {
            const errorMessage = formatApiError(err);
            logger.log('ERROR', 'Phase5', 'Fallo al optimizar las métricas', err);
            alert(`Error en la optimización: ${errorMessage}`);
        }
    };

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
            <div>
                <h2 className="text-2xl font-bold text-green-400">
                    Fase 5: Plan Maestro Premium
                </h2>
                <p className="text-gray-400">
                    Plan detallado enriquecido con las contribuciones de agentes especializados. 
                    Revisa todos los elementos o utiliza la IA para optimizar las métricas de calidad antes de generar la documentación final.
                </p>
            </div>

            {/* NEW: Optional Metrics Optimization Panel */}
            <MetricsOptimizationPanel
              currentMetrics={{
                // FIX: Correctly access nested properties on the `premiumPlan` object.
                viral_potential: premiumPlan.enhanced_metadata?.viral_potential || 0,
                human_authenticity: premiumPlan.enhanced_metadata?.human_authenticity || 0
              }}
              storyPlan={premiumPlan}
              onOptimize={handleOptimizeMetrics}
              isOptimizing={isOptimizing}
            />

            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-6 rounded-lg border border-blue-500/30">
                <h3 className="text-xl font-bold text-blue-300 mb-4">📋 Resumen Ejecutivo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-white mb-2">Metadata Principal</h4>
                        <div className="space-y-2 text-sm">
                            {/* FIX: Correctly access nested properties on the `premiumPlan` object. */}
                            <div><span className="text-gray-400">Título:</span> <span className="text-white font-medium">{premiumPlan.metadata.title}</span></div>
                            <div><span className="text-gray-400">Logline:</span> <span className="text-gray-200">{premiumPlan.metadata.logline}</span></div>
                            <div><span className="text-gray-400">Tema Central:</span> <span className="text-gray-200">{premiumPlan.metadata.theme}</span></div>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-white mb-2">Métricas de Calidad</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/20 p-3 rounded text-center">
                                <div className="text-lg font-bold text-purple-400">
                                    {/* FIX: Correctly access nested properties on the `premiumPlan` object. */}
                                    {(premiumPlan.enhanced_metadata?.viral_potential || 0).toFixed(1)}/10
                                </div>
                                <div className="text-xs text-gray-400">Potencial Viral</div>
                            </div>
                            <div className="bg-black/20 p-3 rounded text-center">
                                <div className="text-lg font-bold text-green-400">
                                    {/* FIX: Correctly access nested properties on the `premiumPlan` object. */}
                                    {(premiumPlan.enhanced_metadata?.human_authenticity || 0).toFixed(2)}%
                                </div>
                                <div className="text-xs text-gray-400">Autenticidad</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-lg">
                <h3 className="text-lg font-bold text-yellow-300 mb-4">👥 Elenco de Personajes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FIX: Correctly access the `characters` array. */}
                    {premiumPlan.characters.map((char, index) => (
                        <div key={index} className="bg-black/20 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-white">{char.name}</h4>
                                <span className="text-xs bg-blue-600 px-2 py-1 rounded text-white">{char.role}</span>
                            </div>
                            <p className="text-sm text-gray-300 mb-2">{char.description}</p>
                            <p className="text-xs text-gray-400 italic">{char.visual_prompt_enhancers}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-green-300">📚 Estructura Narrativa</h3>
                    <button 
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-sm bg-gray-600 px-3 py-1 rounded hover:bg-gray-500"
                    >
                        {showDetails ? 'Ocultar Detalles' : 'Ver Detalles'}
                    </button>
                </div>
                
                {/* FIX: Correctly access the `story_structure` and `narrative_arc` properties. */}
                {premiumPlan.story_structure.narrative_arc.map((act, actIndex) => (
                    <div key={actIndex} className="mb-6 last:mb-0">
                        <h4 className="font-semibold text-white text-md mb-2 p-2 bg-gray-700/50 rounded">
                           Acto {act.act_number}: {act.title} - <span className="font-normal text-gray-300">{act.summary}</span>
                        </h4>
                        
                        {showDetails && (
                            <div className="ml-4 pl-4 border-l-2 border-gray-700 space-y-3">
                                {act.scenes.map((scene, sceneIndex) => (
                                    <div key={sceneIndex} className="bg-black/20 p-3 rounded">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-medium text-blue-300">Escena {scene.scene_number}: {scene.title}</span>
                                            <span className="text-xs bg-red-600 px-2 py-1 rounded text-white flex-shrink-0 ml-2">{scene.emotional_beat}</span>
                                        </div>
                                        <p className="text-sm text-gray-300 mb-2">{scene.summary}</p>
                                        <div className="text-xs text-gray-400">
                                            <span>Personajes: {scene.characters_present.join(', ')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-6 rounded-lg border border-purple-500/30">
                <h3 className="text-lg font-bold text-purple-300 mb-4">🤖 Contribuciones de Agentes Especializados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* FIX: Correctly access nested agent contribution properties. */}
                    {premiumPlan.agent_contributions?.psychology_insights?.length > 0 && (
                        <div className="bg-black/20 p-4 rounded">
                            <h4 className="font-medium text-purple-400 mb-2">🧠 Insights Psicológicos</h4>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                                {premiumPlan.agent_contributions.psychology_insights.map((insight, i) => <li key={i} className="text-gray-300">{insight}</li>)}
                            </ul>
                        </div>
                    )}
                    {premiumPlan.agent_contributions?.viral_optimizations?.length > 0 && (
                        <div className="bg-black/20 p-4 rounded">
                            <h4 className="font-medium text-red-400 mb-2">🚀 Optimizaciones Virales</h4>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                                {premiumPlan.agent_contributions.viral_optimizations.map((optimization, i) => <li key={i} className="text-gray-300">{optimization}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500"
                >
                    ← Volver a Construcción Artística
                </button>
                <button 
                    onClick={() => onComplete(premiumPlan)}
                    className="w-full flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500"
                >
                    Aprobar y Generar Documentación Premium →
                </button>
            </div>
        </div>
    );
};

export default Phase5_PremiumPlan;