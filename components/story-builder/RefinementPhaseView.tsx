/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { StoryMasterplan, Documentation } from './types';
import { DocumentIcon } from '../icons';

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
            <div className="text-center">
                <p>Cargando documentos de refinamiento...</p>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.2: Documentación de Producción</h3>
            <p className="text-gray-400 mb-6">La documentación de producción para tu plan de historia ha sido generada. El siguiente paso es crear una matriz de ganchos virales para maximizar el impacto de tu historia.</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                    <DocumentIcon className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold text-yellow-300">Guía de Producción para IA</h4>
                        <p className="text-sm text-gray-400">El documento técnico con prompts detallados para la IA.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.aiProductionGuide, 'AI_Production_Guide.md')} className="w-full sm:w-auto bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors">
                        Descargar
                    </button>
                </div>
                
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                    <DocumentIcon className="w-8 h-8 text-blue-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold">Guía del Director</h4>
                        <p className="text-sm text-gray-400">El documento maestro de tu proyecto.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.directorsBible, 'Directors_Bible.md')} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-500 transition-colors">
                        Descargar
                    </button>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col sm:flex-row items-center gap-4">
                     <DocumentIcon className="w-8 h-8 text-blue-400 flex-shrink-0" />
                    <div className="flex-grow text-center sm:text-left">
                        <h4 className="font-bold">Guía de Estilo Visual</h4>
                        <p className="text-sm text-gray-400">Dirección visual, paleta de colores, cinematografía y diseño.</p>
                    </div>
                    <button onClick={() => handleDownload(documentation.visualStyleGuide, 'Visual_Style_Guide.md')} className="w-full sm:w-auto bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-500 transition-colors">
                        Descargar
                    </button>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-700 mt-6 flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={handleExportProject} 
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors"
                >
                    📁 Exportar Proyecto (.json)
                </button>
                <button 
                    onClick={onStartHookMatrixGeneration} 
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                >
                    ▶️ Generar Matriz de Ganchos Virales
                </button>
            </div>
        </div>
    );
};

export default RefinementPhaseView;