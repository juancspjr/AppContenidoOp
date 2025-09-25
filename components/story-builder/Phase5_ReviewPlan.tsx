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

const DetailSection: React.FC<{ title: string; children: React.ReactNode, defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
    <details className="bg-gray-900/50 p-4 rounded-lg border border-gray-700" open={defaultOpen}>
        <summary className="text-xl font-bold text-blue-300 cursor-pointer">{title}</summary>
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2 text-gray-300">{children}</div>
    </details>
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
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 5: Revisar el Plan Maestro de la IA</h2>
            <p className="text-gray-400">Este es el plan detallado que la IA ha generado. Revisa todos los detalles. Si estás satisfecho, podemos pasar a la fase de producción para la evaluación final.</p>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <DetailSection title="Metadata" defaultOpen>
                    <p><strong>Título:</strong> {storyPlan.metadata?.title || 'No especificado'}</p>
                    <p><strong>Logline:</strong> {storyPlan.metadata?.logline || 'No especificado'}</p>
                    <p><strong>Tema Central:</strong> {storyPlan.metadata?.theme || 'No especificado'}</p>
                </DetailSection>
                <DetailSection title="Brief Creativo">
                    <p><strong>Concepto:</strong> {storyPlan.creative_brief?.concept || 'No especificado'}</p>
                    <p><strong>Público Objetivo:</strong> {storyPlan.creative_brief?.target_audience || 'No especificado'}</p>
                    <p><strong>Formato de Salida:</strong> {Array.isArray(storyPlan.creative_brief?.output_format) ? storyPlan.creative_brief.output_format.join(', ') : (storyPlan.creative_brief?.output_format || 'No especificado')}</p>
                    <p><strong>Estilo Narrativo:</strong> {Array.isArray(storyPlan.creative_brief?.narrative_style) ? storyPlan.creative_brief.narrative_style.join(', ') : (storyPlan.creative_brief?.narrative_style || 'No especificado')}</p>
                    <p><strong>Estilo Visual:</strong> {Array.isArray(storyPlan.creative_brief?.visual_style) ? storyPlan.creative_brief.visual_style.join(', ') : (storyPlan.creative_brief?.visual_style || 'No especificado')}</p>
                </DetailSection>
                <DetailSection title="Elenco de Personajes">
                    {storyPlan.characters?.filter(Boolean).map(char => (
                        <div key={char.name} className="bg-gray-800/80 p-3 rounded">
                            <h4 className="font-semibold text-gray-200">{char.name} ({char.role})</h4>
                            <p className="text-sm">{char.description}</p>
                            <p className="text-xs mt-1 text-purple-300"><strong>Descripción Visual Clave:</strong> {char.visual_description}</p>
                        </div>
                    )) || <p>No hay personajes definidos.</p>}
                </DetailSection>
                 <DetailSection title="Estructura Narrativa Detallada">
                    {storyPlan.story_structure?.narrative_arc?.filter(Boolean).map(act => (
                        <details key={act.act_number} className="bg-gray-800/80 p-3 rounded mb-2" open={act.act_number === 1}>
                            <summary className="font-semibold text-lg text-gray-200 cursor-pointer hover:text-white">Acto {act.act_number}: {act.title}</summary>
                            <p className="text-sm italic my-2 p-2 bg-black/20 rounded">{act.summary}</p>
                            <div className="pl-4 border-l-2 border-gray-700 space-y-2">
                                <h5 className="font-bold text-gray-300 mt-2">Escenas:</h5>
                                {act.scenes?.filter(Boolean).map(scene => (
                                     <details key={scene.scene_number} className="bg-black/20 p-2 rounded">
                                        <summary className="text-sm font-semibold text-gray-300 cursor-pointer hover:text-white">Escena {scene.scene_number}: {scene.title}</summary>
                                        <div className="text-xs mt-2 pl-2 border-l-2 border-blue-500/50 space-y-1 text-gray-400">
                                            <p><strong>Resumen:</strong> {scene.summary}</p>
                                            <p><strong>Beat Emocional:</strong> {scene.emotional_beat}</p>
                                            <p><strong>Personajes Presentes:</strong> {(scene.characters_present || [])?.join(', ') || 'N/A'}</p>
                                        </div>
                                     </details>
                                )) || <p>No hay escenas en este acto.</p>}
                            </div>
                        </details>
                    )) || <p>No hay estructura narrativa definida.</p>}
                </DetailSection>
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
                    Aprobar Plan y Continuar a Evaluación Final
                </button>
            </div>
        </div>
    );
};

export default Phase5_ReviewPlan;