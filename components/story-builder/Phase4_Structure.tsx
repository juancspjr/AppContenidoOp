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
    onAssist: () => Promise<void>;
    isAssisting: boolean;
}

const Phase4_Structure: React.FC<Phase4_StructureProps> = ({ onComplete, initialData, onBack, onAssist, isAssisting }) => {
    const [structure, setStructure] = useState<StoryStructure>(initialData || {
        act1_summary: '',
        act2_summary: '',
        act3_summary: '',
    });

    useEffect(() => {
        if (initialData) {
            setStructure(initialData);
        }
    }, [initialData]);

    const handleChange = (act: keyof StoryStructure, value: string) => {
        setStructure(prev => ({ ...prev, [act]: value }));
    };

    const canProceed = structure.act1_summary && structure.act2_summary && structure.act3_summary;

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 4: Estructura Narrativa</h2>
                    <p className="text-gray-400">Define los tres actos de tu historia. Un resumen claro para cada acto ayudará a la IA a construir una narrativa coherente.</p>
                </div>
                <button
                    onClick={onAssist}
                    disabled={isAssisting}
                    title="Usa la IA para generar la estructura de tres actos"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-not-allowed"
                >
                    {isAssisting ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isAssisting ? 'Generando...' : 'Generar con IA'}
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="act1" className="block text-sm font-medium text-gray-300 mb-2">Acto 1: El Planteamiento</label>
                    <textarea
                        id="act1"
                        rows={5}
                        value={structure.act1_summary || ''}
                        onChange={e => handleChange('act1_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Presenta a los personajes, el mundo y el conflicto inicial (el 'incidente incitador')."
                    />
                </div>
                <div>
                    <label htmlFor="act2" className="block text-sm font-medium text-gray-300 mb-2">Acto 2: La Confrontación</label>
                    <textarea
                        id="act2"
                        rows={7}
                        value={structure.act2_summary || ''}
                        onChange={e => handleChange('act2_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="El personaje principal se enfrenta a obstáculos crecientes. La tensión aumenta hasta llegar a un punto medio y un clímax del acto."
                    />
                </div>
                <div>
                    <label htmlFor="act3" className="block text-sm font-medium text-gray-300 mb-2">Acto 3: La Resolución</label>
                    <textarea
                        id="act3"
                        rows={5}
                        value={structure.act3_summary || ''}
                        onChange={e => handleChange('act3_summary', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="El clímax final. El conflicto se resuelve y vemos las consecuencias y el 'nuevo normal' para los personajes."
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
                    disabled={!canProceed || isAssisting}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    {canProceed ? 'Revisar Coherencia' : 'Completa todos los actos'}
                </button>
            </div>
        </div>
    );
};

export default Phase4_Structure;