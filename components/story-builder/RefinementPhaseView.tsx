/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { StoryMasterplan, Documentation } from './types';
import { DocumentIcon, DownloadIcon, FolderIcon, PlayIcon } from '../icons';
import Spinner from '../Spinner';
import { projectPersistenceService } from '../../services/projectPersistenceService';

interface RefinementPhaseViewProps {
    storyPlan: StoryMasterplan | null;
    documentation: Documentation | null;
    onContinue: () => void;
}

const RefinementPhaseView: React.FC<RefinementPhaseViewProps> = ({ storyPlan, documentation, onContinue }) => {

    const handleDownload = (content: string, filename: string, mimeType = 'text/markdown;charset=utf-8') => {
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

    const handleDownloadJson = (content: object, filename: string) => {
        if (!content) return;
        const jsonString = JSON.stringify(content, null, 2);
        handleDownload(jsonString, filename, 'application/json');
    };
    
    const handleExportProjectFile = () => {
        const project = projectPersistenceService.loadProject();
        if (!project) {
            alert("No hay proyecto guardado para exportar.");
            return;
        }
        const title = project.storyPlan?.metadata?.title?.replace(/\s+/g, '_') || 'Untitled_Project';
        handleDownload(JSON.stringify(project, null, 2), `${title}_Project_Checkpoint.json`, 'application/json');
    };

    if (!storyPlan || !documentation) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="text-gray-400 mt-4">Generando dossier de producción profesional...</p>
            </div>
        );
    }
    
    const prompts = documentation.aiProductionGuide?.prompts;

    return (
        <div className="animate-fade-in space-y-8">
             <div>
                <h2 className="text-2xl font-bold text-green-400">Fase 6.2: Dossier de Producción Creativa</h2>
                <p className="text-gray-400">El equipo de producción de IA ha preparado el dossier de tu proyecto. Revisa, descarga y guarda tu progreso. Cuando estés listo, da la luz verde para empezar a crear los activos visuales.</p>
            </div>

            <div className="bg-slate-900/70 rounded-xl p-2 border border-slate-700/50 space-y-1">
                {/* Master README */}
                <details className="p-3 bg-slate-800/50 rounded-lg group" open>
                    <summary className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-900/50 p-2 rounded-lg"><DocumentIcon className="w-6 h-6 text-green-400" /></div>
                            <div>
                                <h4 className="font-bold text-white">README_MASTER.md</h4>
                                <p className="text-sm text-gray-400">El índice y resumen de todo tu dossier de producción.</p>
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(documentation.readme, 'README_MASTER.md'); }} className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-500 transition-colors text-sm">
                            Descargar
                        </button>
                    </summary>
                    <pre className="mt-4 p-4 bg-black/30 rounded-md text-xs text-gray-300 whitespace-pre-wrap max-h-60 overflow-y-auto">{documentation.readme}</pre>
                </details>
                
                {/* Narrative Documents */}
                <details className="p-3 hover:bg-slate-800/50 rounded-lg group">
                    <summary className="flex items-center justify-between cursor-pointer">
                         <div className="flex items-center gap-4">
                            <div className="bg-purple-900/50 p-2 rounded-lg"><DocumentIcon className="w-6 h-6 text-purple-400" /></div>
                            <div>
                                <h4 className="font-bold text-white">Documentos Narrativos (ES/EN)</h4>
                                <p className="text-sm text-gray-400">Cuento literario y guion profesional.</p>
                            </div>
                        </div>
                    </summary>
                    <div className="mt-4 pt-3 border-t border-slate-700 space-y-2">
                         <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Historia Narrativa Completa</span>
                            <button onClick={() => handleDownload(documentation.narrativeStory, 'Narrative_Story.md')} className="bg-purple-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-purple-500 text-xs">Descargar</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Guion Literario</span>
                            <button onClick={() => handleDownload(documentation.literaryScript, 'Literary_Script.md')} className="bg-purple-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-purple-500 text-xs">Descargar</button>
                        </div>
                    </div>
                </details>

                {/* Artistic Documents */}
                 <details className="p-3 hover:bg-slate-800/50 rounded-lg group">
                    <summary className="flex items-center justify-between cursor-pointer">
                         <div className="flex items-center gap-4">
                            <div className="bg-blue-900/50 p-2 rounded-lg"><DocumentIcon className="w-6 h-6 text-blue-400" /></div>
                            <div>
                                <h4 className="font-bold text-white">Guías Artísticas (ES/EN)</h4>
                                <p className="text-sm text-gray-400">Biblia del director y guía de estilo visual.</p>
                            </div>
                        </div>
                    </summary>
                     <div className="mt-4 pt-3 border-t border-slate-700 space-y-2">
                         <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Biblia del Director</span>
                            <button onClick={() => handleDownload(documentation.directorsBible, 'Directors_Bible.md')} className="bg-blue-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-blue-500 text-xs">Descargar</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Guía de Estilo Visual</span>
                            <button onClick={() => handleDownload(documentation.visualStyleGuide, 'Visual_Style_Guide.md')} className="bg-blue-600 text-white font-bold py-1 px-3 rounded-lg hover:bg-blue-500 text-xs">Descargar</button>
                        </div>
                    </div>
                </details>

                {/* AI Production Guide */}
                {prompts && <details className="p-3 hover:bg-slate-800/50 rounded-lg group">
                    <summary className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="bg-yellow-900/50 p-2 rounded-lg"><DocumentIcon className="w-6 h-6 text-yellow-400" /></div>
                            <div>
                                <h4 className="font-bold text-white">Guía de Producción para IA (JSON)</h4>
                                <p className="text-sm text-gray-400">Documento técnico con prompts estructurados para la IA.</p>
                            </div>
                        </div>
                    </summary>
                     <div className="mt-4 pt-3 border-t border-slate-700 space-y-2">
                         <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Prompts de Personajes (.json)</span>
                            <button onClick={() => handleDownloadJson(prompts.character_master_prompts, 'prompts_characters.json')} className="bg-yellow-500 text-black font-bold py-1 px-3 rounded-lg hover:bg-yellow-400 text-xs">Descargar</button>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Prompts de Storyboard (.json)</span>
                            <button onClick={() => handleDownloadJson(prompts.storyboard_groups, 'prompts_storyboard.json')} className="bg-yellow-500 text-black font-bold py-1 px-3 rounded-lg hover:bg-yellow-400 text-xs">Descargar</button>
                        </div>
                         <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Prompts Negativos (.json)</span>
                            <button onClick={() => handleDownloadJson(prompts.negative_prompts, 'prompts_negative.json')} className="bg-yellow-500 text-black font-bold py-1 px-3 rounded-lg hover:bg-yellow-400 text-xs">Descargar</button>
                        </div>
                         <div className="flex justify-between items-center p-2 bg-black/20 rounded-md">
                            <span>Prompts de Audio (.json)</span>
                            <button onClick={() => handleDownloadJson(prompts.audio_generation_prompts, 'prompts_audio.json')} className="bg-yellow-500 text-black font-bold py-1 px-3 rounded-lg hover:bg-yellow-400 text-xs">Descargar</button>
                        </div>
                    </div>
                </details>}

            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <button 
                    onClick={handleExportProjectFile} 
                    className="w-full sm:w-auto bg-slate-700 text-slate-200 font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2.5"
                >
                    <FolderIcon className="w-5 h-5"/>
                    Exportar Archivo de Proyecto (.json)
                </button>
                <button 
                    onClick={onContinue} 
                    className="w-full sm:w-auto bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center gap-2.5 shadow-lg shadow-green-500/20 hover:shadow-green-500/40"
                >
                    <PlayIcon className="w-5 h-5" />
                    Continuar al Taller de Dirección Artística
                </button>
            </div>
        </div>
    );
};

export default RefinementPhaseView;