/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect } from 'react';
import { BrushIcon, EraserIcon, ClearIcon, PhotoIcon, XCircleIcon, SparkleIcon } from './icons';

interface MagicEditPanelProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  featherSize: number;
  setFeatherSize: (size: number) => void;
  brushMode: 'brush' | 'erase';
  setBrushMode: (mode: 'brush' | 'erase') => void;
  onClearMask: () => void;
  onGenerate: () => void;
  isLoading: boolean;
  hasMask: boolean;
  referenceImage: File | null;
  onReferenceImageSelect: (file: File) => void;
  onClearReferenceImage: () => void;
  enhancePrompt: boolean;
  setEnhancePrompt: (value: boolean) => void;
}

const MagicEditPanel: React.FC<MagicEditPanelProps> = ({
  prompt, setPrompt, brushSize, setBrushSize, featherSize, setFeatherSize, brushMode, setBrushMode, 
  onClearMask, onGenerate, isLoading, hasMask,
  referenceImage, onReferenceImageSelect, onClearReferenceImage,
  enhancePrompt, setEnhancePrompt
}) => {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (referenceImage) {
        const url = URL.createObjectURL(referenceImage);
        setReferenceImageUrl(url);
        return () => URL.revokeObjectURL(url);
    } else {
        setReferenceImageUrl(null);
    }
  }, [referenceImage]);
  
  const handleReferenceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onReferenceImageSelect(e.target.files[0]);
    }
    e.target.value = '';
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-full bg-gray-900/50 border border-gray-700/80 rounded-lg p-4 text-gray-300 space-y-2">
            <h3 className="text-lg font-semibold text-center text-gray-100">Cómo usar la Edición Mágica</h3>
            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
                <li><span className="font-semibold text-gray-300">Pinta una máscara:</span> Usa las herramientas de pincel para pintar sobre el área que quieres cambiar.</li>
                <li><span className="font-semibold text-gray-300">Describe la edición:</span> Escribe lo que quieres hacer (ej. "eliminar a esta persona", "añadir un sombrero").</li>
                <li><span className="font-semibold text-gray-300">Genera:</span> Haz clic en el botón para que la IA realice la edición.</li>
            </ol>
        </div>
        
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-col md:flex-row flex-wrap items-center gap-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setBrushMode('brush')}
                    className={`p-3 rounded-md transition-colors ${brushMode === 'brush' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                    aria-label="Brush Mode"
                    title="Pincel: Pinta para seleccionar el área a editar."
                >
                    <BrushIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={() => setBrushMode('erase')}
                    className={`p-3 rounded-md transition-colors ${brushMode === 'erase' ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                    aria-label="Erase Mode"
                    title="Borrador: Borra partes de la selección."
                >
                    <EraserIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-grow flex items-center gap-3 w-full sm:w-auto" title="Ajusta el tamaño del pincel.">
                <label htmlFor="brush-size" className="text-gray-300 text-sm font-medium">Tamaño:</label>
                <input
                    id="brush-size"
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    aria-label="Brush size"
                />
            </div>
            <div className="flex-grow flex items-center gap-3 w-full sm:w-auto" title="Ajusta la suavidad de los bordes de la selección para una mejor integración.">
                <label htmlFor="feather-size" className="text-gray-300 text-sm font-medium">Suavizado:</label>
                <input
                    id="feather-size"
                    type="range"
                    min="0"
                    max="20"
                    value={featherSize}
                    onChange={(e) => setFeatherSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    aria-label="Feather size"
                />
            </div>
            <button
                onClick={onClearMask}
                disabled={!hasMask || isLoading}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Clear Mask"
                title="Borrar toda la máscara de selección."
            >
                <ClearIcon className="w-5 h-5" />
                Limpiar
            </button>
        </div>

        <div className="w-full bg-gray-900/50 border border-gray-700/80 rounded-lg p-4 text-gray-300 space-y-3">
            <div className="flex items-center gap-3">
                <SparkleIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                <h3 className="text-md font-semibold text-gray-100">Asistente de IA para Prompts</h3>
            </div>
            <p className="text-sm text-gray-400">
                Permite que nuestro Agente de IA refine tu descripción para obtener resultados más detallados y fotorrealistas. Desmárcalo si prefieres usar tu texto exacto.
            </p>
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="enhance-prompt-toggle"
                    checked={enhancePrompt}
                    onChange={(e) => setEnhancePrompt(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="enhance-prompt-toggle" className="ml-2 text-sm font-medium text-gray-300">
                    Mejorar mi prompt con IA
                </label>
            </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onGenerate(); }} className="w-full flex flex-col gap-3">
            <div className="flex items-start gap-3">
                <textarea
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={hasMask ? "ej. 'añade un casco futurista'" : "Primero pinta una máscara en la imagen"}
                    className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-4 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 resize-none"
                    disabled={isLoading || !hasMask}
                    title={hasMask ? "Describe el cambio que quieres hacer en el área seleccionada." : "Debes pintar una máscara antes de poder escribir una instrucción."}
                />
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={referenceInputRef}
                    onChange={handleReferenceFileSelect}
                    className="hidden"
                />
                <div className="flex-shrink-0">
                    {referenceImageUrl ? (
                        <div className="relative group">
                            <img src={referenceImageUrl} alt="Reference" className="w-20 h-20 object-cover rounded-lg" />
                            <button 
                                type="button"
                                onClick={onClearReferenceImage}
                                className="absolute -top-2 -right-2 bg-gray-900 rounded-full text-gray-300 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                aria-label="Remove reference image"
                                title="Eliminar la imagen de referencia"
                            >
                                <XCircleIcon className="w-7 h-7" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => referenceInputRef.current?.click()}
                            disabled={isLoading || !hasMask}
                            className="w-20 h-20 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Upload Reference Image"
                            title="Sube una imagen de referencia para guiar a la IA (opcional)."
                        >
                            <PhotoIcon className="w-8 h-8" />
                            <span className="text-xs mt-1">Referencia</span>
                        </button>
                    )}
                </div>
            </div>
            <button 
                type="submit"
                className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                disabled={isLoading || !hasMask}
                title={!hasMask ? "Debes pintar una máscara para poder generar." : "Iniciar el proceso de edición con la IA."}
            >
                Generar
            </button>
        </form>
    </div>
  );
};

export default MagicEditPanel;