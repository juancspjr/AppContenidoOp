
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Corrected React import statement.
import React, { useState, useEffect } from 'react';
import type { StyleAndFormat } from './types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from './constants';
import { SparkleIcon } from '../icons';
import Spinner from '../Spinner';

interface Phase2_StyleProps {
    onComplete: (data: StyleAndFormat) => void;
    initialData: StyleAndFormat | null;
    onBack: () => void;
    onSuggest: () => Promise<void>;
    isSuggesting: boolean;
}

type StyleCategory = keyof StyleAndFormat;

const allStyles = {
    outputFormat: { data: outputFormats, isMulti: true, isRequired: true, name: 'Formato de Salida' },
    narrativeStyle: { data: narrativeStyles, isMulti: true, isRequired: true, name: 'Estilo Narrativo' },
    visualStyle: { data: visualStyles, isMulti: true, isRequired: true, name: 'Estilo Visual' },
    narrativeStructure: { data: { "Estructuras Narrativas": narrativeStructures }, isMulti: true, isRequired: false, name: 'Estructura Narrativa (Opcional)' },
    hook: { data: hookTypes, isMulti: true, isRequired: false, name: 'Gancho Inicial (Opcional)' },
    conflict: { data: conflictTypes, isMulti: true, isRequired: false, name: 'Conflicto Principal (Opcional)' },
    ending: { data: endingTypes, isMulti: true, isRequired: false, name: 'Tipo de Final (Opcional)' },
};

const Phase2_Style: React.FC<Phase2_StyleProps> = ({ onComplete, initialData, onBack, onSuggest, isSuggesting }) => {
    const [style, setStyle] = useState<StyleAndFormat>(initialData || {});

    useEffect(() => {
        // This effect syncs the local state if the initialData prop changes
        // (e.g., after an AI suggestion is fetched in the parent component).
        setStyle(initialData || {});
    }, [initialData]);

    const handleToggle = (category: StyleCategory, value: string) => {
        setStyle(prev => {
            const currentValues = (prev[category] as string[] | undefined) || [];
            const isMulti = allStyles[category as keyof typeof allStyles]?.isMulti ?? false;
            
            if (isMulti) {
                const newValues = currentValues.includes(value)
                    ? currentValues.filter(v => v !== value)
                    : [...currentValues, value];

                if (newValues.length > 4) {
                    alert('Puedes seleccionar un máximo de 4 opciones por categoría.');
                    return prev;
                }
                return { ...prev, [category]: newValues };
            } else {
                // For single-select, either select or deselect
                const newValues = currentValues.includes(value) ? [] : [value];
                return { ...prev, [category]: newValues };
            }
        });
    };

    const isComplete = (style.outputFormat?.length ?? 0) > 0 && 
                       (style.narrativeStyle?.length ?? 0) > 0 && 
                       (style.visualStyle?.length ?? 0) > 0;

    const handleSubmit = () => {
        if (isComplete) {
            onComplete(style);
        }
    };

    const renderCategory = (
        categoryKey: StyleCategory,
    ) => {
        const config = allStyles[categoryKey as keyof typeof allStyles];
        if (!config) return null;
        
        const selected = (style[categoryKey] as string[] | undefined) || [];
        
        return (
            <div key={categoryKey}>
                <h3 className="text-lg font-semibold text-gray-200 mb-2">{config.name} {config.isRequired && <span className="text-red-400">*</span>}</h3>
                {Object.entries(config.data).map(([subCategory, items]) => (
                    <div key={subCategory} className="mb-3">
                        <h4 className="font-bold text-gray-400 mb-2">{subCategory}</h4>
                        <div className="flex flex-wrap gap-2">
                            {items.map(item => {
                                const isSelected = selected.includes(item.name);
                                return (
                                    <button
                                        key={item.name}
                                        onClick={() => handleToggle(categoryKey, item.name)}
                                        title={item.description}
                                        className={`px-3 py-2 text-sm rounded-md transition-all duration-200 border ${
                                            isSelected
                                                ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                                                : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                                        }`}
                                    >
                                        {item.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                 <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 2: Estilo y Formato</h2>
                    <p className="text-gray-400">Define el look & feel de tu historia. La IA puede sugerir combinaciones coherentes.</p>
                </div>
                 <button 
                    onClick={onSuggest}
                    disabled={isSuggesting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 disabled:cursor-wait"
                >
                    {isSuggesting ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    {isSuggesting ? 'Sugiriendo...' : 'Sugerir con IA'}
                </button>
            </div>

            <div className="space-y-6">
                {renderCategory('outputFormat' as StyleCategory)}
                {renderCategory('narrativeStyle' as StyleCategory)}
                {renderCategory('visualStyle' as StyleCategory)}
                
                <details open className="bg-gray-900/30 p-4 rounded-lg cursor-pointer transition-all">
                    <summary className="font-semibold text-lg text-gray-300 hover:text-white">Opciones Avanzadas de Narrativa</summary>
                    <div className="mt-4 space-y-6 border-t border-gray-700 pt-4">
                        {renderCategory('narrativeStructure' as StyleCategory)}
                        {renderCategory('hook' as StyleCategory)}
                        {renderCategory('conflict' as StyleCategory)}
                        {renderCategory('ending' as StyleCategory)}
                    </div>
                </details>

                <div>
                    <label htmlFor="styleNotes" className="block text-lg font-semibold text-gray-200 mb-2">Notas de Estilo Adicionales (La IA las leerá)</label>
                    <textarea
                        id="styleNotes"
                        rows={4}
                        value={style.styleNotes || ''}
                        onChange={e => setStyle(prev => ({...prev, styleNotes: e.target.value}))}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Añade cualquier detalle específico sobre el estilo, tono, o 'vibe' que quieres. La IA usará esto como guía."
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onBack} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500">Atrás</button>
                <button 
                    onClick={handleSubmit} 
                    disabled={!isComplete || isSuggesting}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    {isComplete ? 'Continuar a Personajes' : 'Completa las secciones requeridas (*)'}
                </button>
            </div>
        </div>
    );
};

export default Phase2_Style;