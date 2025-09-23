/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StoryStructure } from './types';
import { SparkleIcon } from '../icons';
import Spinner from '../Spinner';

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
    
    useEffect(() => {
        setStructure(initialData || {});
    }, [initialData]);

    const canProceed = structure.act1_summary && structure.act2_summary && structure.act3_summary;
    
    const handleTextChange = (act: keyof StoryStructure, value: string) => {
        setStructure(prev => ({...prev, [act]: value}));
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 4: Estructura Narrativa</h2>
                    <p className="text-gray-400">Define los tres actos de tu historia. Puedes escribirlos o dejar que la IA los genere por ti.</p>
                </div>
                 <button 
                    onClick={onGenerate}
                    disabled={isGenerating || !areKeysConfigured}
                    title={!areKeysConfigured ? "Configura tus claves de API para activar la IA" : "Generar la estructura con IA"}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-not-allowed"
                >
                    {isGenerating ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isGenerating ? 'Generando...' : 'Generar con IA'}
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="act1" className="block text-lg font-medium text-gray-300 mb-2">Acto 1: El Planteamiento</label>
                    <textarea
                        id="act1"
                        rows={6}
                        value={structure.act1_summary || ''}
                        onChange={e => handleTextChange('act1_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Presenta a los personajes, el mundo y el conflicto inicial (incidente incitador)."
                    />
                </div>
                 <div>
                    <label htmlFor="act2" className="block text-lg font-medium text-gray-300 mb-2">Acto 2: La Confrontación</label>
                    <textarea
                        id="act2"
                        rows={6}
                        value={structure.act2_summary || ''}
                        onChange={e => handleTextChange('act2_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="El protagonista enfrenta obstáculos crecientes. La tensión aumenta hasta el punto medio y el clímax del segundo acto."
                    />
                </div>
                 <div>
                    <label htmlFor="act3" className="block text-lg font-medium text-gray-300 mb-2">Acto 3: La Resolución</label>
                    <textarea
                        id="act3"
                        rows={6}
                        value={structure.act3_summary || ''}
                        onChange={e => handleTextChange('act3_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="La historia llega a su clímax, donde el conflicto principal se resuelve. Se muestra el nuevo estado de los personajes y su mundo."
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={onBack}
                    className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors"
                >
                    Atrás
                </button>
                <button 
                    onClick={() => onComplete(structure)} 
                    disabled={!canProceed || isGenerating}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    {canProceed ? 'Continuar al Análisis de Coherencia' : 'Completa los tres actos'}
                </button>
            </div>
        </div>
    );
};

export default Phase4_Structure;
