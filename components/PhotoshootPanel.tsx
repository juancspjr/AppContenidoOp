/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { PhotoIcon, XCircleIcon } from './icons';

interface PhotoshootPanelProps {
  onGenerate: (scenePrompt: string, numImages: number, sceneImage: File | null) => void;
  isLoading: boolean;
}

const PhotoshootPanel: React.FC<PhotoshootPanelProps> = ({ 
  onGenerate, 
  isLoading, 
}) => {
  const [scenePrompt, setScenePrompt] = useState('');
  const [numImages, setNumImages] = useState(4);
  const [sceneImage, setSceneImage] = useState<File | null>(null);
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sceneImage) {
        const url = URL.createObjectURL(sceneImage);
        setSceneImageUrl(url);
        return () => URL.revokeObjectURL(url);
    } else {
        setSceneImageUrl(null);
    }
  }, [sceneImage]);
  
  const handleSceneFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSceneImage(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleClearSceneImage = () => {
    setSceneImage(null);
  };

  const handleGenerateClick = () => {
    if (scenePrompt.trim() || sceneImage) {
      onGenerate(scenePrompt, numImages, sceneImage);
    }
  };

  const canGenerate = !isLoading && (!!scenePrompt.trim() || !!sceneImage);

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-300">Simulador de Sesión de Fotos</h3>
        <p className="text-sm text-gray-400">Describe una escena, o sube una imagen de fondo, y el Agente de IA creará una sesión de fotos realista.</p>
      </div>
      
      <div className="w-full bg-gray-900/50 border border-gray-700/80 rounded-lg p-4 text-gray-300 space-y-2">
            <h3 className="text-md font-semibold text-gray-100">Instrucciones</h3>
            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1">
                <li><span className="font-semibold text-gray-300">Proporciona el fondo:</span> Escribe una descripción de la escena O sube una imagen del fondo que quieras usar.</li>
                <li><span className="font-semibold text-gray-300">Elige el número de tomas:</span> Selecciona cuántas variaciones quieres generar (hasta 10).</li>
                <li><span className="font-semibold text-gray-300">Genera:</span> El Agente de IA creará prompts detallados para cada toma para asegurar el máximo realismo.</li>
            </ol>
        </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-grow flex items-start gap-3">
            <textarea
              rows={3}
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              placeholder="Describe la escena O sube una imagen de fondo (ej. 'sentado en el sofá', 'caminando por Tokio de noche')"
              className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base resize-none"
              disabled={isLoading}
              title="Describe la escena o cómo interactuar con la imagen de fondo."
            />
            <input 
                type="file" 
                accept="image/*" 
                ref={sceneInputRef}
                onChange={handleSceneFileSelect}
                className="hidden"
            />
            <div className="flex-shrink-0">
                {sceneImageUrl ? (
                    <div className="relative group">
                        <img src={sceneImageUrl} alt="Scene" className="w-24 h-24 object-cover rounded-lg" />
                        <button 
                            type="button"
                            onClick={handleClearSceneImage}
                            className="absolute -top-2 -right-2 bg-gray-900 rounded-full text-gray-300 hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            aria-label="Remove scene image"
                            title="Eliminar la imagen de escena"
                        >
                            <XCircleIcon className="w-7 h-7" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => sceneInputRef.current?.click()}
                        disabled={isLoading}
                        className="w-24 h-24 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Upload Scene Image"
                        title="Sube una imagen del escenario o fondo que quieres usar."
                    >
                        <PhotoIcon className="w-8 h-8" />
                        <span className="text-xs mt-1 text-center">Subir Escena</span>
                    </button>
                )}
            </div>
        </div>
        <div className="flex-shrink-0 flex flex-col gap-2 bg-gray-800 border border-gray-600 rounded-lg p-4 self-start">
            <label htmlFor="num-images" className="font-semibold text-gray-300 text-center">Nº de Tomas</label>
            <input 
                type="number"
                id="num-images"
                min="1"
                max="10"
                value={numImages}
                onChange={(e) => setNumImages(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-24 bg-gray-900 border border-gray-500 rounded-md p-2 text-center text-lg font-bold"
                disabled={isLoading}
                title="Elige cuántas imágenes generar (1-10)."
            />
        </div>
      </div>
      
        <button
            onClick={handleGenerateClick}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={!canGenerate}
            title={!canGenerate ? "Primero, describe o sube una escena para generar." : "Iniciar la sesión de fotos virtual."}
        >
            {isLoading ? 'Generando...' : 'Generar Escena'}
        </button>
    </div>
  );
};

export default PhotoshootPanel;