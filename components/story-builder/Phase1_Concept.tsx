/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { InitialConcept } from './types';
import { SparkleIcon } from '../icons';
import Spinner from '../Spinner';

interface Phase1_ConceptProps {
    onComplete: (data: InitialConcept) => void;
    initialData: InitialConcept | null;
    onAssist: (idea: string) => Promise<void>;
    isAssisting: boolean;
}

const textModels = [
    { name: "Gemini 2.5 Flash (Rápido y Equilibrado)", value: "gemini-2.5-flash" },
    { name: "Gemini 2.5 Pro (Máxima Calidad)", value: "gemini-2.5-pro" },
    { name: "Gemini 2.5 Pro Preview 06-05", value: "models/gemini-2.5-pro-preview-06-05" },
    { name: "Gemini 2.5 Flash Preview 05-20", value: "models/gemini-2.5-flash-preview-05-20" },
    { name: "Gemini 2.5 Flash Lite", value: "models/gemini-2.5-flash-lite" },
    { name: "Gemma 3 12B IT", value: "models/gemma-3-12b-it" },
    { name: "Gemma 3 4B IT", value: "models/gemma-3-4b-it" },
];

const imageModels = [
    // FIX: Updated model name and value to match API guidelines.
    { name: "Imagen 4.0 (Alta Calidad)", value: "imagen-4.0-generate-001" },
    { name: "Nano Banana (Rápido)", value: "gemini-2.5-flash-image-preview" },
];


const Phase1_Concept: React.FC<Phase1_ConceptProps> = ({ onComplete, initialData, onAssist, isAssisting }) => {
    const [idea, setIdea] = useState(initialData?.idea || '');
    const [targetAudience, setTargetAudience] = useState(initialData?.targetAudience || '');
    const [keyElements, setKeyElements] = useState(initialData?.keyElements?.join(', ') || '');
    const [selectedTextModel, setSelectedTextModel] = useState(initialData?.selectedTextModel || 'gemini-2.5-flash');
    // FIX: Updated default state to use the new recommended image model.
    const [selectedImageModel, setSelectedImageModel] = useState(initialData?.selectedImageModel || 'imagen-4.0-generate-001');

    useEffect(() => {
        if (initialData) {
            setIdea(initialData.idea || '');
            setTargetAudience(initialData.targetAudience || '');
            setKeyElements(initialData.keyElements?.join(', ') || '');
            setSelectedTextModel(initialData.selectedTextModel || 'gemini-2.5-flash');
            setSelectedImageModel(initialData.selectedImageModel || 'imagen-4.0-generate-001');
        }
    }, [initialData]);

    const canProceed = idea.trim().length > 20;

    const handleSubmit = () => {
        if (canProceed) {
            onComplete({
                idea,
                targetAudience,
                keyElements: keyElements.split(',').map(s => s.trim()).filter(Boolean),
                selectedTextModel,
                selectedImageModel,
            });
        }
    };

    const handleAssistClick = () => {
        if (idea.trim()) {
            onAssist(idea);
        } else {
            alert("Por favor, escribe una idea inicial antes de usar la asistencia de IA.");
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 1: La Idea Principal</h2>
                    <p className="text-gray-400">Todo gran proyecto empieza con una idea. Descríbela o deja que la IA la refine por ti.</p>
                </div>
                 <button 
                    onClick={handleAssistClick}
                    disabled={isAssisting || !idea.trim()}
                    title={!idea.trim() ? "Escribe una idea para activar la IA" : "Usa la IA para refinar y completar esta fase"}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-not-allowed"
                >
                    {isAssisting ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isAssisting ? 'Generando...' : 'Generar con IA'}
                </button>
            </div>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="text-model" className="block text-sm font-medium text-gray-300 mb-2">Modelo de IA de Texto</label>
                        <select
                            id="text-model"
                            value={selectedTextModel}
                            onChange={e => setSelectedTextModel(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        >
                            {textModels.map(model => (
                                <option key={model.value} value={model.value}>{model.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="image-model" className="block text-sm font-medium text-gray-300 mb-2">Modelo de IA de Imagen</label>
                        <select
                            id="image-model"
                            value={selectedImageModel}
                            onChange={e => setSelectedImageModel(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        >
                            {imageModels.map(model => (
                                <option key={model.value} value={model.value}>{model.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="idea" className="block text-sm font-medium text-gray-300 mb-2">Tu Idea (requerido)</label>
                    <textarea
                        id="idea"
                        rows={5}
                        value={idea}
                        onChange={e => setIdea(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Un cortometraje de ciencia ficción sobre un robot jardinero que descubre una planta que puede sentir emociones."
                    />
                    {idea.trim().length > 0 && idea.trim().length <= 20 &&
                        <p className="text-xs text-yellow-400 mt-1">Sigue escribiendo, ¡necesitamos un poco más de detalle!</p>
                    }
                </div>
                <div>
                    <label htmlFor="audience" className="block text-sm font-medium text-gray-300 mb-2">Público Objetivo (opcional)</label>
                    <input
                        id="audience"
                        type="text"
                        value={targetAudience}
                        onChange={e => setTargetAudience(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: Jóvenes adultos interesados en la tecnología y la ecología."
                    />
                </div>
                <div>
                    <label htmlFor="elements" className="block text-sm font-medium text-gray-300 mb-2">Elementos Clave (opcional, separados por comas)</label>
                    <input
                        id="elements"
                        type="text"
                        value={keyElements}
                        onChange={e => setKeyElements(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: amistad, sacrificio, naturaleza vs tecnología, neón"
                    />
                </div>
            </div>
            
            <button 
                onClick={handleSubmit} 
                disabled={!canProceed || isAssisting}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
            >
                Continuar a Estilo y Formato
            </button>
        </div>
    );
};

export default Phase1_Concept;