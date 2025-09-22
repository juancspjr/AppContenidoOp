/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
// FIX: Corrected relative import path.
import type { StoryMasterplan, Documentation } from './types';
import { DocumentIcon, DownloadIcon, ExportIcon } from '../icons';

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
    
    const title = storyPlan.metadata.title;

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-green-400">Fase 6.2: Documentación de Producción</h2>
            <p className="text-gray-400">Los agentes de IA han generado la documentación clave para tu proyecto "{title}". Revisa y descarga estos documentos para la siguiente etapa de producción.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col items-center text-center">
                    <DocumentIcon className="w-10 h-10 text-blue-400 mb-3" />
                    <h3 className="font-bold">Biblia del Director</h3>
                    <p className="text-sm text-gray-400 flex-grow my-2">Visión general, tono, estilo y arcos de personajes.</p>
                    <button onClick={() => handleDownload(documentation.directorsBible, `${title}_Directors_Bible.md`)} className="w-full mt-2 text-sm flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors">
                        <DownloadIcon className="w-4 h-4" />
                        Descargar
                    </button>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col items-center text-center">
                    <DocumentIcon className="w-10 h-10 text-blue-400 mb-3" />
                    <h3 className="font-bold">Guía de Producción IA</h3>
                    <p className="text-sm text-gray-400 flex-grow my-2">Prompts sugeridos para la generación de visuales e imágenes.</p>
                     <button onClick={() => handleDownload(documentation.aiProductionGuide, `${title}_AI_Production_Guide.md`)} className="w-full mt-2 text-sm flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors">
                        <DownloadIcon className="w-4 h-4" />
                        Descargar
                    </button>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 flex flex-col items-center text-center">
                    <DocumentIcon className="w-10 h-10 text-blue-400 mb-3" />
                    <h3 className="font-bold">Guía de Estilo Visual</h3>
                    <p className="text-sm text-gray-400 flex-grow my-2">Referencias de color, composición y atmósfera.</p>
                     <button onClick={() => handleDownload(documentation.visualStyleGuide, `${title}_Visual_Style_Guide.md`)} className="w-full mt-2 text-sm flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors">
                        <DownloadIcon className="w-4 h-4" />
                        Descargar
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
                    Continuar a la Generación de Ganchos ➡️
                </button>
            </div>
        </div>
    );
};

export default RefinementPhaseView;