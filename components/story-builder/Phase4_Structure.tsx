/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StoryStructure } from './types';
import Spinner from '../Spinner';
import { SparkleIcon } from '../icons';

interface Phase4_StructureProps {
    onComplete: (data: StoryStructure) => void;
    initialData: StoryStructure | null;
    onBack: () => void;
    onGenerate: () => Promise<void>;
    isGenerating: boolean;
    areKeysConfigured: boolean;
}

const Phase4_Structure: React.FC<Phase4_StructureProps> = ({ onComplete, initialData, onBack, onGenerate, isGenerating, areKeysConfigured }) => {
    const [structure, setStructure] = useState<StoryStructure>(initialData || {});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setStructure(initialData || {});
    }, [initialData]);
    
    const updateStructure = (key: keyof StoryStructure, value: string) => {
        setStructure(prev => ({...prev, [key]: value}));
    };
    
    const handleSubmit = () => {
        setIsSubmitting(true);
        // This now triggers the coherence check agent in the parent component
        onComplete(structure);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 4: Estructura de la Historia</h2>
                    <p className="text-gray-400">Esboza la trama o deja que la IA la cree o mejore por ti.</p>
                </div>
                 <button 
                    onClick={onGenerate}
                    disabled={isGenerating || isSubmitting || !areKeysConfigured}
                    title={!areKeysConfigured ? "Configura tus claves de API para activar la IA" : "Generar o mejorar la estructura con IA"}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isGenerating ? 'Procesando...' : 'Generar/Mejorar con IA'}
                </button>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label htmlFor="act1" className="block text-sm font-medium text-gray-300 mb-2">Acto 1: El Planteamiento</label>
                    <textarea
                        id="act1"
                        rows={4}
                        value={structure.act1_summary || ''}
                        onChange={e => updateStructure('act1_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder="Presenta a los personajes, el mundo y el conflicto inicial (el 'incidente incitador')."
                        disabled={isGenerating || isSubmitting}
                    />
                </div>
                <div>
                    <label htmlFor="act2" className="block text-sm font-medium text-gray-300 mb-2">Acto 2: La Confrontación</label>
                    <textarea
                        id="act2"
                        rows={4}
                        value={structure.act2_summary || ''}
                        onChange={e => updateStructure('act2_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder="El protagonista se enfrenta a obstáculos cada vez mayores, culminando en un punto de crisis a mitad de la historia."
                        disabled={isGenerating || isSubmitting}
                    />
                </div>
                <div>
                    <label htmlFor="act3" className="block text-sm font-medium text-gray-300 mb-2">Acto 3: La Resolución</label>
                    <textarea
                        id="act3"
                        rows={4}
                        value={structure.act3_summary || ''}
                        onChange={e => updateStructure('act3_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        placeholder="La historia alcanza su clímax, y el conflicto se resuelve. Se muestra la 'nueva normalidad' para los personajes."
                        disabled={isGenerating || isSubmitting}
                    />
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={onBack}
                    disabled={isSubmitting || isGenerating}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
                >
                    Atrás
                </button>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || isGenerating}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:bg-blue-800 disabled:cursor-wait"
                >
                    {isSubmitting ? (
                        <>
                            <Spinner className="w-5 h-5 animate-spin" />
                            Iniciando Análisis...
                        </>
                    ) : (
                        'Analizar Coherencia Estructural'
                    )}
                </button>
            </div>
        </div>
    );
};

export default Phase4_Structure;