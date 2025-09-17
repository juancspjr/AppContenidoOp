/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface CropPanelProps {
  onApplyCrop: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  isCropping: boolean;
}

type AspectRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '3:4' | '9:16';

const aspectTooltips: Record<AspectRatio, string> = {
    'free': 'Recorte libre, sin proporciones fijas.',
    '1:1': 'Recorte cuadrado, ideal para perfiles.',
    '4:3': 'Formato de cámara clásica y monitores antiguos.',
    '3:2': 'Formato de sensor de cámara DSLR y película de 35mm.',
    '16:9': 'Recorte panorámico, ideal para portadas o videos.',
    '3:4': 'Formato de retrato clásico.',
    '9:16': 'Formato vertical, ideal para historias y móviles.',
};

const CropPanel: React.FC<CropPanelProps> = ({ onApplyCrop, onSetAspect, isLoading, isCropping }) => {
  const [activeAspect, setActiveAspect] = useState<AspectRatio>('free');
  
  const handleAspectChange = (aspect: AspectRatio, value: number | undefined) => {
    setActiveAspect(aspect);
    onSetAspect(value);
  }

  const aspects: { name: AspectRatio, value: number | undefined }[] = [
    { name: 'free', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '4:3', value: 4 / 3 },
    { name: '3:2', value: 3 / 2 },
    { name: '16:9', value: 16 / 9 },
    { name: '3:4', value: 3 / 4 },
    { name: '9:16', value: 9 / 16 },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">Recortar Imagen</h3>
      <p className="text-sm text-gray-400 -mt-2">Haz clic y arrastra sobre la imagen para seleccionar un área de recorte.</p>
      
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-sm font-medium text-gray-400">Proporción:</span>
        {aspects.map(({ name, value }) => (
          <button
            key={name}
            onClick={() => handleAspectChange(name, value)}
            disabled={isLoading}
            title={aspectTooltips[name]}
            className={`px-4 py-2 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
              activeAspect === name 
              ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
              : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <button
        onClick={onApplyCrop}
        disabled={isLoading || !isCropping}
        title={!isCropping ? "Primero selecciona un área en la imagen para recortar." : "Aplicar el área de recorte seleccionada."}
        className="w-full max-w-xs mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Aplicar Recorte
      </button>
    </div>
  );
};

export default CropPanel;