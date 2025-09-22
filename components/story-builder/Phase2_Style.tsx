/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
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

const StyleCategory: React.FC<{
    label: string;
    options: { name: string, description: string }[];
    selected: string[];
    onChange: (value: string) => void;
    required?: boolean;
}> = ({ label, options, selected, onChange, required }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">{label}{required && <span className="text-red-400">*</span>}</h3>
        <div className="flex flex-wrap gap-2">
            {options.map(opt => {
                const isSelected = selected.includes(opt.name);
                return (
                    <button
                        key={opt.name}
                        title={opt.description}
                        onClick={() => onChange(opt.name)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all duration-200 transform active:scale-95 ${
                            isSelected 
                            ? 'bg-blue-500 border-blue-400 text-white shadow-md shadow-blue-500/20' 
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                        }`}
                    >
                        {isSelected && '✓ '}
                        {opt.name}
                    </button>
                );
            })}
        </div>
    </div>
);


const Phase2_Style: React.FC<Phase2_StyleProps> = ({ onComplete, initialData, onBack, onSuggest, isSuggesting }) => {
    const [style, setStyle] = useState<StyleAndFormat>(initialData || {});

    // Update local state when initialData changes from AI suggestion
    React.useEffect(() => {
        setStyle(prevStyle => ({ ...prevStyle, ...initialData }));
    }, [initialData]);

    const handleSelectionChange = (key: keyof StyleAndFormat, value: string) => {
        setStyle(prev => {
            const currentValues = (prev[key] as string[] | undefined) || [];
            const isSelected = currentValues.includes(value);

            let newValues: string[];
            if (isSelected) {
                newValues = currentValues.filter(item => item !== value);
            } else {
                if (currentValues.length < 3) {
                    newValues = [...currentValues, value];
                } else {
                    alert("Puedes seleccionar hasta 3 opciones por categoría.");
                    newValues = currentValues;
                }
            }
            // The type assertion is safe because we are targeting array fields.
            return { ...prev, [key]: newValues as any };
        });
    };
    
    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setStyle(prev => ({...prev, styleNotes: e.target.value}));
    };

    const canProceed = style.outputFormat && style.outputFormat.length > 0 &&
                       style.narrativeStyle && style.narrativeStyle.length > 0 &&
                       style.visualStyle && style.visualStyle.length > 0;

    const flattenOptions = (obj: Record<string, {name: string, description: string}[]>) => Object.values(obj).flat();

    const categories: { key: keyof StyleAndFormat, label: string, options: any[], required?: boolean }[] = [
        { key: 'outputFormat', label: 'Formato de Salida', options: flattenOptions(outputFormats), required: true },
        { key: 'narrativeStyle', label: 'Estilo Narrativo', options: flattenOptions(narrativeStyles), required: true },
        { key: 'visualStyle', label: 'Estilo Visual', options: flattenOptions(visualStyles), required: true },
        { key: 'narrativeStructure', label: 'Estructura Narrativa (Opcional)', options: narrativeStructures },
        { key: 'hook', label: 'Tipo de Gancho (Hook) (Opcional)', options: flattenOptions(hookTypes) },
        { key: 'conflict', label: 'Tipo de Conflicto (Opcional)', options: flattenOptions(conflictTypes) },
        { key: 'ending', label: 'Tipo de Final (Opcional)', options: flattenOptions(endingTypes) },
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-300">Fase 2: Estilo y Formato</h2>
                    <p className="text-gray-400">Define el look & feel de tu historia. Elige hasta 3 opciones por categoría o deja que la IA lo haga por ti.</p>
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
            
            <div className="space-y-4">
                {categories.map(cat => (
                    <StyleCategory
                        key={cat.key}
                        label={cat.label}
                        options={cat.options}
                        selected={(style[cat.key] as string[] | undefined) || []}
                        onChange={(value) => handleSelectionChange(cat.key, value)}
                        required={cat.required}
                    />
                ))}
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                     <h3 className="text-lg font-semibold text-gray-200 mb-3">Notas Adicionales de Estilo (Opcional)</h3>
                     <textarea
                        rows={4}
                        value={style.styleNotes || ''}
                        onChange={handleNotesChange}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe cualquier detalle específico que la IA deba considerar, como una paleta de colores, un movimiento de cámara particular, o una referencia a un artista no listado."
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
                    onClick={() => onComplete(style)} 
                    disabled={!canProceed}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    {canProceed ? 'Continuar a Personajes' : 'Completa los campos requeridos (*)'}
                </button>
            </div>
        </div>
    );
};

export default Phase2_Style;
