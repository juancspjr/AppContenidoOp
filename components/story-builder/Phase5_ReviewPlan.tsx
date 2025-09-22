/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StoryMasterplan } from './types';
import Spinner from '../Spinner';

interface Phase5_ReviewPlanProps {
    storyPlan: StoryMasterplan | null;
    onApprove: () => void;
    onRegenerate: () => void;
    onPlanUpdate: (updatedPlan: StoryMasterplan) => void;
}

const Phase5_ReviewPlan: React.FC<Phase5_ReviewPlanProps> = ({ storyPlan, onApprove, onRegenerate, onPlanUpdate }) => {
    
    const [isEditing, setIsEditing] = useState(false);
    const [editablePlan, setEditablePlan] = useState<StoryMasterplan | null>(storyPlan);
    
    useEffect(() => {
        setEditablePlan(storyPlan);
    }, [storyPlan]);

    if (!editablePlan) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="mt-4 text-gray-400">Cargando el plan maestro generado...</p>
            </div>
        );
    }
    
    const handleSave = () => {
        if(editablePlan) {
            onPlanUpdate(editablePlan);
        }
        setIsEditing(false);
    };

    const { metadata, story_structure } = editablePlan;
    
    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-green-400">Fase 5: Revisión del Plan Maestro</h2>
                    <p className="text-gray-400">Revisa y, si lo deseas, edita el borrador de la IA antes de continuar.</p>
                </div>
                 {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500">
                        ✏️ Editar Plan
                    </button>
                )}
                 {isEditing && (
                    <button onClick={handleSave} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500">
                        💾 Guardar Cambios
                    </button>
                )}
            </div>
            
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4">
                {isEditing ? (
                    <input 
                        type="text"
                        value={metadata.title}
                        onChange={(e) => setEditablePlan(p => p && ({ ...p, metadata: { ...p.metadata, title: e.target.value } }))}
                        className="w-full text-center text-xl font-bold bg-gray-800 p-2 rounded"
                    />
                ) : (
                    <h3 className="text-xl font-bold text-center">{metadata.title}</h3>
                )}
                
                <div className="bg-black/20 p-3 rounded-md">
                    <p className="font-semibold text-blue-300">Logline:</p>
                    {isEditing ? (
                        <textarea 
                            value={metadata.logline}
                            onChange={(e) => setEditablePlan(p => p && ({ ...p, metadata: { ...p.metadata, logline: e.target.value } }))}
                            className="w-full bg-gray-800 p-2 rounded mt-1 text-gray-300 italic"
                            rows={2}
                        />
                    ) : (
                        <p className="text-gray-300 italic">"{metadata.logline}"</p>
                    )}
                </div>

                <div className="space-y-3">
                    {story_structure.narrative_arc.map((act, index) => (
                        <div key={act.act_number} className="bg-gray-800/50 p-3 rounded-md">
                            <h4 className="font-bold text-lg text-gray-100">Acto {act.act_number}: {act.title}</h4>
                             {isEditing ? (
                                <textarea
                                    value={act.summary}
                                    onChange={(e) => setEditablePlan(p => {
                                        if (!p) return null;
                                        const newArc = [...p.story_structure.narrative_arc];
                                        newArc[index].summary = e.target.value;
                                        return { ...p, story_structure: { ...p.story_structure, narrative_arc: newArc } };
                                    })}
                                    className="w-full bg-gray-800 p-2 rounded mt-2 text-gray-400 whitespace-pre-wrap"
                                    rows={5}
                                />
                            ) : (
                                <p className="mt-2 text-gray-400 whitespace-pre-wrap">{act.summary}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-6 border-t border-gray-700 mt-6 flex flex-col sm:flex-row gap-4">
                 <button 
                    onClick={onRegenerate}
                    disabled={isEditing}
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
                >
                    🔄 Regenerar Plan
                </button>
                <button 
                    onClick={onApprove}
                    disabled={isEditing}
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                    {isEditing ? 'Guarda los cambios para continuar' : '✅ Aprobar y Continuar a Producción'}
                </button>
            </div>
        </div>
    );
};

export default Phase5_ReviewPlan;