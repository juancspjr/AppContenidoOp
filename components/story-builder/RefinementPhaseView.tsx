/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { StoryMasterplan, Documentation } from './types';
import { DocumentIcon, ExportIcon } from '../icons';
import Spinner from '../Spinner';

interface RefinementPhaseViewProps {
    storyPlan: StoryMasterplan | null;
    documentation: Documentation | null;
    onStartHookMatrixGeneration: () => void;
}

const RefinementPhaseView: React.FC<RefinementPhaseViewProps> = ({ storyPlan, documentation, onStartHookMatrixGeneration }) => {

    const handleDownload = (content: string, filename: string, mimeType = 'text/plain') => {
        if (!content) return;
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    
    const handleExportProject = () => {
        if (!storyPlan) return;
        const title = storyPlan?.metadata?.title?.replace(/\s+/g, '_') || 'Untitled_Project';
        handleDownload(JSON.stringify(storyPlan, null, 2), `${title}_StoryMasterplan.json`, 'application/json');
    };

    if (!storyPlan || !documentation) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="text-gray-400 mt-4">Cargando documentos de pre-producción...</p>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 6.2: Mesa de Pre-Producción</h2>
            <p className="text-gray-400">Los "jefes de departamento" de la IA han preparado los planos de tu proyecto. Revísalos y descárgalos. Cuando estés listo, da la luz verde para empezar a crear los activos visuales.</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                    <DocumentIcon className="w-10 h-10 text-yellow-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold text-yellow-300">Guía de Producción para IA</h4>
                        <p className="text-sm text-gray-400">El manual técnico con los prompts visuales detallados, especificaciones y notas de producción para cada escena.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.aiProductionGuide, 'AI_Production_Guide.md')} className="w-full sm:w-auto bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors">
                        Descargar Guía
                    </button>
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                    <DocumentIcon className="w-10 h-10 text-blue-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold text-blue-300">Biblia del Director</h4>
                        <p className="text-sm text-gray-400">La visión artística. Explica la filosofía, la dirección de personajes, el ritmo y las técnicas narrativas.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.directorsBible, 'Directors_Bible.md')} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-500 transition-colors">
                        Descargar Biblia
                    </button>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                     <DocumentIcon className="w-10 h-10 text-teal-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold text-teal-300">Guía de Estilo Visual</h4>
                        <p className="text-sm text-gray-400">El manual de identidad visual. Define la cinematografía, la paleta de colores, la iluminación y el diseño de producción.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.visualStyleGuide, 'Visual_Style_Guide.md')} className="w-full sm:w-auto bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-500 transition-colors">
                        Descargar Guía
                    </button>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-700 mt-6 flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={handleExportProject} 
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
                >
                    <ExportIcon className="w-5 h-5"/>
                    Exportar Plan Maestro (.json)
                </button>
                <button 
                    onClick={onStartHookMatrixGeneration} 
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                >
                    Generar Activos de Referencia ➡️
                </button>
            </div>
        </div>
    );
};

export default RefinementPhaseView;