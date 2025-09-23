/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import type { StoryMasterplan } from './types';
import Spinner from '../Spinner';

interface Phase5_ReviewPlanProps {
    onComplete: () => void;
    onBack: () => void;
    storyPlan: StoryMasterplan | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void;
    onRegenerate: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-xl font-bold text-blue-300 mb-3">{title}</h3>
        <div className="space-y-2 text-gray-300">{children}</div>
    </div>
);

const Phase5_ReviewPlan: React.FC<Phase5_ReviewPlanProps> = ({
    onComplete, onBack, storyPlan, isGenerating, error, onGenerate, onRegenerate
}) => {
    
    React.useEffect(() => {
        if (!storyPlan && !isGenerating && !error) {
            onGenerate();
        }
    }, [storyPlan, isGenerating, error, onGenerate]);
    
    if (error) {
        return (
             <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error al Generar el Plan de IA</h3>
                <p className="mb-4">{error}</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Atrás</button>
                    <button onClick={onRegenerate} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar Generación</button>
                </div>
            </div>
        );
    }

    if (isGenerating || !storyPlan) {
        return (
            <div className="text-center animate-fade-in">
                <Spinner />
                <h3 className="text-xl font-bold mt-4">Generando Plan de Historia Maestro...</h3>
                <p className="text-gray-400">El Agente Director está consolidando toda la información en un plan de producción detallado.</p>
            </div>
        );
    }
    
    const { metadata, creative_brief, characters, story_structure } = storyPlan;

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 5: Revisar el Plan de IA</h2>
            <p className="text-gray-400">Este es el plan maestro que la IA ha generado. Revisa todos los detalles. Si estás satisfecho, podemos pasar a la fase de producción.</p>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <Section title="Metadata">
                    <p><strong>Título:</strong> {metadata.title}</p>
                    <p><strong>Logline:</strong> {metadata.logline}</p>
                    <p><strong>Tema:</strong> {metadata.theme}</p>
                </Section>
                <Section title="Brief Creativo">
                    <p><strong>Concepto:</strong> {creative_brief.concept}</p>
                    <p><strong>Público Objetivo:</strong> {creative_brief.target_audience}</p>
                    <p><strong>Formato:</strong> {Array.isArray(creative_brief.output_format) ? creative_brief.output_format.join(', ') : creative_brief.output_format}</p>
                    <p><strong>Estilo Narrativo:</strong> {Array.isArray(creative_brief.narrative_style) ? creative_brief.narrative_style.join(', ') : creative_brief.narrative_style}</p>
                    <p><strong>Estilo Visual:</strong> {Array.isArray(creative_brief.visual_style) ? creative_brief.visual_style.join(', ') : creative_brief.visual_style}</p>
                </Section>
                <Section title="Personajes">
                    {characters.map(char => (
                        <div key={char.name} className="bg-gray-800/80 p-3 rounded">
                            <h4 className="font-semibold text-gray-200">{char.name} ({char.role})</h4>
                            <p className="text-sm">{char.description}</p>
                            <p className="text-xs mt-1 text-purple-300"><strong>Visual:</strong> {char.visual_description}</p>
                        </div>
                    ))}
                </Section>
                 <Section title="Estructura Narrativa">
                    {story_structure.narrative_arc.map(act => (
                        <details key={act.act_number} className="bg-gray-800/80 p-3 rounded" open={act.act_number === 1}>
                            <summary className="font-semibold text-gray-200 cursor-pointer">Acto {act.act_number}: {act.title}</summary>
                            <p className="text-sm italic my-2">{act.summary}</p>
                            <div className="pl-4 border-l-2 border-gray-700 space-y-2">
                                {act.scenes.map(scene => (
                                     <details key={scene.scene_number} className="bg-black/20 p-2 rounded">
                                        <summary className="text-sm font-semibold text-gray-300 cursor-pointer">Escena {scene.scene_number}: {scene.title}</summary>
                                        <div className="text-xs mt-2 pl-2 border-l-2 border-blue-500/50 space-y-1">
                                            <p><strong>Resumen:</strong> {scene.summary}</p>
                                            <p><strong>Beat Emocional:</strong> {scene.emotional_beat}</p>
                                            <p><strong>Personajes:</strong> {scene.characters_present.join(', ')}</p>
                                        </div>
                                     </details>
                                ))}
                            </div>
                        </details>
                    ))}
                </Section>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
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
                    Aprobar Plan y Continuar a Producción
                </button>
            </div>
        </div>
    );
};

export default Phase5_ReviewPlan;
