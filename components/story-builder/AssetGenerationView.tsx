/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import type { StoryMasterplan, FinalAssets, ProgressUpdate } from './types';
import Spinner from '../Spinner';
import { DownloadIcon } from '../icons';
import { imageBlobCache } from '../../services/imageBlobCache';

interface AssetGenerationViewProps {
    isLoading: boolean;
    progress: Record<string, ProgressUpdate>;
    assets: FinalAssets | null;
    error: string | null;
    storyPlan: StoryMasterplan | null;
    onRegenerate: () => void;
    onGoToPhase: (phase: number) => void;
}

const ProgressItem: React.FC<{ update: ProgressUpdate | undefined, label: string }> = ({ update, label }) => {
    const getStatusIcon = () => {
        if (!update || update.status === 'in_progress') return <div className="w-5 h-5"><Spinner className="w-full h-full animate-spin" /></div>;
        if (update.status === 'complete') return <span className="text-green-400 text-xl">✅</span>;
        if (update.status === 'error') return <span className="text-red-400 text-xl">❌</span>;
        return <span className="text-gray-400 text-xl">⏳</span>;
    };

    const progressPercentage = update?.totalSegments 
        ? ((update.segment || 0) / update.totalSegments) * 100 
        : update?.progress;

    return (
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex items-center gap-4">
            <div className="w-6 h-6 flex items-center justify-center">{getStatusIcon()}</div>
            <div className="flex-grow">
                <p className="font-semibold text-gray-200">{label}</p>
                {update && <p className="text-sm text-gray-400">{update.message}</p>}
            </div>
            {progressPercentage !== undefined && (
                <div className="w-24 text-right text-sm font-mono text-blue-300">{progressPercentage.toFixed(0)}%</div>
            )}
        </div>
    );
};

const VideoPlayer: React.FC<{ assetId: string, downloadName: string }> = ({ assetId, downloadName }) => {
    const [videoUrl, setVideoUrl] = useState<string>('');

    useEffect(() => {
        let url = '';
        const blob = imageBlobCache.get(assetId);
        if (blob) {
            url = URL.createObjectURL(blob);
            setVideoUrl(url);
        }
        return () => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [assetId]);

    if (!videoUrl) {
        return <div className="w-full rounded-lg bg-black aspect-video flex items-center justify-center"><Spinner className="w-10 h-10 animate-spin text-white" /></div>;
    }

    return (
        <div className="w-full">
            <video src={videoUrl} controls className="w-full rounded-lg bg-black aspect-video"></video>
            <a href={videoUrl} download={downloadName} className="w-full mt-2 text-sm flex items-center justify-center gap-2 bg-white/10 text-white font-semibold py-2 rounded-lg hover:bg-white/20 transition-colors">
                <DownloadIcon className="w-4 h-4" />
                Descargar Segmento
            </a>
        </div>
    );
};


const AssetGenerationView: React.FC<AssetGenerationViewProps> = ({
    isLoading,
    progress,
    assets,
    error,
    storyPlan,
    onRegenerate,
    onGoToPhase,
}) => {

    const scenes = storyPlan?.story_structure?.narrative_arc?.flatMap(act => act?.scenes || []).filter(Boolean) || [];

    if (isLoading && Object.keys(progress).length === 0) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="text-gray-400 mt-4">Iniciando pipeline de generación de video...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en la Generación de Videos</h3>
                <p className="mb-4">{error}</p>
                <div className="flex justify-center gap-4">
                     <button onClick={() => onGoToPhase(4)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Volver al Plan</button>
                    <button onClick={onRegenerate} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar Generación</button>
                </div>
            </div>
        )
    }

    if (assets) {
        const title = storyPlan?.metadata?.title?.replace(/\s+/g, '_') || 'final_video';

        return (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-bold mb-2 text-green-400">🎉 ¡Generación Completada!</h3>
                <p className="text-gray-400 mb-6">Tus videos han sido generados por segmentos para asegurar la máxima calidad y coherencia. Descárgalos y únelos en tu editor de video favorito.</p>
                
                <h4 className="text-lg font-semibold mb-2">Videos por Escena</h4>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {scenes.map(scene => {
                        const sceneId = `scene_${scene.scene_number}`;
                        const sceneVideos = assets.videoAssets.filter(a => a.sceneId === sceneId).sort((a,b) => a.segment - b.segment);
                        
                        if (sceneVideos.length === 0) return null;

                        return (
                            <div key={sceneId} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h5 className="font-bold">Escena {scene.scene_number}: {scene.title}</h5>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sceneVideos.map(video => (
                                         <div key={video.segment} className="w-full">
                                            <p className="text-sm font-semibold text-gray-300 mb-1">Segmento {video.segment}</p>
                                            <VideoPlayer 
                                                assetId={video.assetId} 
                                                downloadName={`${title}_S${scene.scene_number}_P${video.segment}.mp4`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }

    const renderSceneProgress = () => {
        return scenes.map(scene => {
            const sceneId = `scene_${scene.scene_number}`;
            const sceneProgress = Object.values(progress).filter(p => p.sceneId === sceneId);
            const subPromptUpdate = sceneProgress.find(p => p.stage === 'sub_prompts');
            const videoUpdates = sceneProgress.filter(p => p.stage === 'videos').sort((a,b) => (a.segment || 0) - (b.segment || 0));

            return (
                 <div key={sceneId} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                    <h4 className="font-bold text-gray-200">Escena {scene.scene_number}: {scene.title}</h4>
                     <div className="pl-4 mt-2 border-l-2 border-gray-700 space-y-2">
                         <ProgressItem update={subPromptUpdate} label="1. Planificación (Sub-Prompts)" />
                         {videoUpdates.map(update => {
                             const frameExtractionUpdate = sceneProgress.find(p => p.stage === 'frame_extraction' && p.segment === update.segment);
                             return (
                                 <div key={`segment_${update.segment}`}>
                                     <ProgressItem update={update} label={`2.${update.segment || 0} Generando Segmento ${update.segment}/${update.totalSegments}`} />
                                     {frameExtractionUpdate && <ProgressItem update={frameExtractionUpdate} label={`2.${update.segment || 0}b Extrayendo Frame de Continuidad`} />}
                                 </div>
                             )
                         })}
                     </div>
                 </div>
            )
        })
    }

    return (
        <div className="animate-fade-in">
             <h3 className="text-2xl font-bold mb-2 text-blue-300">Fase 6.4: Generación de Video Secuencial</h3>
            <p className="text-gray-400 mb-6">Nuestros agentes están construyendo los videos largos en segmentos encadenados para garantizar la coherencia. Este proceso avanzado puede tardar varios minutos.</p>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {renderSceneProgress()}
                <ProgressItem update={progress['complete']} label="Generación Completa" />
            </div>
        </div>
    );
};

export default AssetGenerationView;