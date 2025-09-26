/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StyleAndFormat, StyleSuggestions } from './types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from './constants';
import { SparkleIcon } from '../icons';
import Spinner from '../Spinner';

interface Phase2_StyleProps {
    onComplete: (data: StyleAndFormat) => void;
    initialData: StyleAndFormat | null;
    onBack: () => void;
    onSuggest: () => Promise<void>;
    onUpdateStyle: (data: Partial<StyleAndFormat>) => void;
    onClearSuggestions: () => void;
    isSuggesting: boolean;
    error: string | null;
    suggestions: StyleSuggestions | null;
}

const allCategories = {
    outputFormat: { label: "Formato de Salida", options: outputFormats },
    narrativeStyle: { label: "Estilo Narrativo", options: narrativeStyles },
    visualStyle: { label: "Estilo Visual", options: visualStyles },
    narrativeStructure: { label: "Estructura Narrativa", options: narrativeStructures },
    hook: { label: "Tipo de Gancho (Hook)", options: hookTypes },
    conflict: { label: "Tipo de Conflicto Principal", options: conflictTypes },
    ending: { label: "Tipo de Final", options: endingTypes }
};

type CategoryKey = keyof typeof allCategories;

const SelectorGrid: React.FC<{
    title: string;
    description: string;
    options: Record<string, { name: string; value?: string; description: string }[]>;
    selected: string[];
    onToggle: (value: string) => void;
}> = ({ title, description, options, selected, onToggle }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-bold text-blue-300">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        <div className="space-y-3">
            {Object.keys(options).map((groupName) => (
                <div key={groupName}>
                    <h4 className="font-semibold text-gray-200 text-sm mb-2">{groupName}</h4>
                    <div className="flex flex-wrap gap-2">
                        {options[groupName].map(option => {
                            const value = option.value || option.name;
                            const isSelected = selected.includes(value);
                            return (
                                <button
                                    key={value}
                                    onClick={() => onToggle(value)}
                                    title={option.description}
                                    className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                                        isSelected 
                                        ? 'bg-blue-600 text-white font-semibold' 
                                        : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'
                                    }`}
                                >
                                    {option.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    </div>
);


const Phase2_Style: React.FC<Phase2_StyleProps> = ({ 
    onComplete, initialData, onBack, onSuggest, onUpdateStyle, onClearSuggestions,
    isSuggesting, error, suggestions 
}) => {
    const [style, setStyle] = useState<StyleAndFormat>(initialData || { energyLevel: 5 });

    useEffect(() => {
        if (initialData) setStyle(initialData);
    }, [initialData]);

    const handleToggle = (category: CategoryKey, value: string) => {
        const currentSelection = (style[category] as string[] | undefined) || [];
        const newSelection = currentSelection.includes(value)
            ? currentSelection.filter(item => item !== value)
            : [...currentSelection, value];
        onUpdateStyle({ [category]: newSelection });
    };
    
    // The main style object is now updated directly from the state machine via onUpdateStyle,
    // so we listen to `initialData` to reflect those changes.
    useEffect(() => {
        setStyle(initialData || { energyLevel: 5 });
    }, [initialData]);

    const canProceed = Object.values(style).some(val => Array.isArray(val) ? val.length > 0 : (typeof val === 'number' ? true : !!val));

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 2: Estilo y Formato</h2>
                    <p className="text-gray-400">Define el "look & feel" de tu historia. Estas elecciones guiarán a la IA en la creación de contenido.</p>
                </div>
                <button 
                    onClick={onSuggest}
                    disabled={isSuggesting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800"
                >
                   {isSuggesting ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isSuggesting ? 'Sugiriendo...' : 'Sugerir con IA'}
                </button>
            </div>
            
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}

            {suggestions && (
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-6 rounded-lg border border-blue-500/30 mb-6 animate-fade-in">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-blue-400">🎯 Sugerencias de IA</h3>
                            <p className="text-sm text-gray-300 mt-1">{suggestions.justificacion}</p>
                        </div>
                        <button onClick={onClearSuggestions} className="text-gray-400 hover:text-white text-sm">✕ Cerrar</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(suggestions).map(([key, value]) => {
                            if (key === 'justificacion' || !Array.isArray(value)) return null;
                            const categoryKey = key as keyof StyleSuggestions;

                            return (
                                <div key={categoryKey} className="bg-black/20 p-4 rounded-lg">
                                    <h4 className="font-semibold text-white mb-2 capitalize">{categoryKey.replace(/([A-Z])/g, ' $1')}</h4>
                                    <div className="space-y-2">
                                        {(value as string[]).map((option, idx) => (
                                            <label key={idx} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={(style[categoryKey as keyof StyleAndFormat] as string[] | undefined)?.includes(option) || false}
                                                    onChange={(e) => {
                                                        const current = (style[categoryKey as keyof StyleAndFormat] as string[] | undefined) || [];
                                                        const newValues = e.target.checked ? [...current, option] : current.filter(v => v !== option);
                                                        onUpdateStyle({ [categoryKey]: newValues });
                                                    }}
                                                    className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-300">{option}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => onUpdateStyle({ [categoryKey]: value })}
                                        className="mt-3 w-full bg-blue-700 text-white py-1.5 px-3 rounded text-xs hover:bg-blue-600"
                                    >
                                        Aplicar Todas ({value.length})
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                     <div className="flex gap-4 mt-6">
                        <button
                            onClick={() => {
                                const allSuggestedStyles: Partial<StyleAndFormat> = {};
                                Object.entries(suggestions).forEach(([key, value]) => {
                                    if (key !== 'justificacion') {
                                        (allSuggestedStyles as any)[key] = value;
                                    }
                                });
                                onUpdateStyle(allSuggestedStyles);
                            }}
                            className="flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500"
                        >
                            ✅ Aplicar Todas las Sugerencias
                        </button>
                    </div>
                </div>
            )}
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {Object.entries(allCategories).map(([key, data]) => (
                    <SelectorGrid
                        key={key}
                        title={data.label}
                        description=""
                        options={data.options}
                        selected={(style[key as CategoryKey] as string[]) || []}
                        onToggle={(value) => handleToggle(key as CategoryKey, value)}
                    />
                ))}
                 <div>
                    <label htmlFor="energy" className="block text-sm font-medium text-gray-300 mb-2">Nivel de Energía (1=Lento/Contemplativo, 10=Frenético/Intenso)</label>
                    <input
                        id="energy"
                        type="range"
                        min="1" max="10"
                        value={style.energyLevel}
                        onChange={e => onUpdateStyle({ energyLevel: Number(e.target.value) })}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="text-center font-bold text-lg mt-1">{style.energyLevel}</div>
                </div>
                 <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">Notas Adicionales de Estilo (opcional)</label>
                    <textarea
                        id="notes"
                        rows={3}
                        value={style.styleNotes || ''}
                        onChange={e => onUpdateStyle({ styleNotes: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3"
                        placeholder="Ej: 'Quiero un look similar a la película Blade Runner 2049', 'La música debe ser synthwave ochentera'."
                    />
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button onClick={onBack} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors">Atrás</button>
                <button 
                    onClick={() => onComplete(style)}
                    disabled={!canProceed}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                   {canProceed ? 'Continuar a Personajes' : 'Selecciona al menos un estilo'}
                </button>
            </div>
        </div>
    );
};

export default Phase2_Style;