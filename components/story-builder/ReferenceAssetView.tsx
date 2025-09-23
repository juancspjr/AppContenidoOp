/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import type { StoryMasterplan, ReferenceAssets, ProgressUpdate, ReferenceAsset } from './types';
import Spinner from '../Spinner';
import { assetDBService } from '../../services/assetDBService';
import { logger } from '../../utils/logger';
import { DownloadIcon, SparkleIcon } from '../icons';

// New icons for the enhanced asset card
const LockClosedIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
    </svg>
);

const PaintBrushIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
        <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h1a1 1 0 011 1v3.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-1a1 1 0 01-1-1V3.5zM3.5 6a1.5 1.5 0 000 3V10a1 1 0 01-1 1H2a1 1 0 00-1 1v3.5a1.5 1.5 0 003 0V15a1 1 0 011-1h1a1 1 0 001-1V9.5a1.5 1.5 0 00-3 0V6z" />
    </svg>
);


interface ReferenceAssetViewProps {
    isLoading: boolean;
    progress: Record<string, ProgressUpdate>;
    assets: ReferenceAssets | null;
    error: string | null;
    storyPlan: StoryMasterplan | null;
    onRegenerateAll: () => void;
    onRegenerateSingle: (asset: ReferenceAsset, instruction?: string) => void;
    onGenerateSceneMatrix: (sceneNumber: number) => void;
    onContinue: () => void;
    onGoToPhase: (phase: number) => void;
}

const AssetCard: React.FC<{ 
    asset: ReferenceAsset, 
    onRegenerate: (asset: ReferenceAsset, instruction?: string) => void,
    // onUpdateInstruction is now handled internally
}> = ({ asset, onRegenerate }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [instruction, setInstruction] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const { assetId, name, description, generationStatus, visualPrompt } = asset;

    useEffect(() => {
        let objectUrl: string | null = null;
        const loadImage = async () => {
            if (!assetId) return;
            try {
                const blob = await assetDBService.loadAsset(assetId);
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageUrl(objectUrl);
                }
            } catch(err) {
                 logger.log('ERROR', 'AssetCard', `Error cargando blob para assetId: ${assetId}`, err);
            }
        };
        
        loadImage();
        
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [assetId]);
    
    const handleDownload = () => {
        if(imageUrl) {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `${name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(a);
a.click();
            document.body.removeChild(a);
        }
    }

    const isGenerating = generationStatus === 'generating';

    return (
        <div className={`bg-gray-800 rounded-lg p-3 relative group flex flex-col gap-2 border ${isLocked ? 'border-yellow-500' : 'border-transparent'}`}>
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <button 
                    onClick={() => setIsLocked(!isLocked)}
                    className="bg-black/60 text-white rounded-full p-1.5 backdrop-blur-sm"
                    title={isLocked ? "Desbloquear Activo (Quitar de la Biblia de Consistencia)" : "Bloquear Activo (Añadir a la Biblia de Consistencia)"}
                 >
                    <LockClosedIcon className={`h-4 w-4 ${isLocked ? 'text-yellow-400' : ''}`} />
                </button>
                 <button 
                    onClick={() => { /* Modal logic for inpainting would go here */ alert('Funcionalidad de Edición Mágica en desarrollo.'); }}
                    className="bg-black/60 text-white rounded-full p-1.5 backdrop-blur-sm"
                    title="Editar Mágicamente (Inpainting/Outpainting)"
                 >
                    <PaintBrushIcon className="h-4 w-4" />
                </button>
                 <button 
                    onClick={() => onRegenerate(asset, instruction)}
                    className="bg-black/60 text-white rounded-full p-1.5 backdrop-blur-sm"
                    title="Regenerar este activo con las indicaciones"
                    disabled={isGenerating}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.899 2.186l-1.002.501a5.999 5.999 0 00-10.05-1.932V5a1 1 0 01-2 0V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.899-2.186l1.002-.501a5.999 5.999 0 0010.05 1.932V15a1 1 0 012 0v2a1 1 0 01-1 1z" clipRule="evenodd" /></svg>
                </button>
                 <button 
                    onClick={handleDownload}
                    className="bg-black/60 text-white rounded-full p-1.5 backdrop-blur-sm"
                    title="Descargar imagen"
                    disabled={!imageUrl}
                 >
                    <DownloadIcon className="h-4 w-4" />
                </button>
            </div>
            <div className="w-full aspect-square bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                {isGenerating ? (
                    <Spinner className="w-8 h-8"/>
                ) : imageUrl ? (
                    <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded" />
                ) : (
                    <div className="text-center text-xs text-gray-400 p-2">Imagen no disponible</div>
                )}
            </div>
            <div className="flex-grow">
                <h5 className="font-bold truncate text-gray-200">{name}</h5>
                <p className="text-xs text-gray-400 h-8 overflow-hidden" title={description}>{description}</p>
            </div>
             <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Ver Prompt</summary>
                <p className="mt-1 bg-black/30 p-1.5 rounded text-gray-400">{visualPrompt}</p>
            </details>
            <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                placeholder="Indicaciones para regenerar (ej. 'hazla de cuero negro')"
                className="w-full bg-gray-900 text-xs border border-gray-600 rounded p-2 focus:ring-1 focus:ring-blue-500"
                disabled={isGenerating}
            />
        </div>
    );
};

const ReferenceAssetView: React.FC<ReferenceAssetViewProps> = ({
    isLoading, progress, assets, error, storyPlan,
    onRegenerateAll, onRegenerateSingle, onGenerateSceneMatrix,
    onContinue, onGoToPhase,
}) => {

    const handleRegenerateClick = () => {
        if (window.confirm("¿Estás seguro de que quieres regenerar todos los activos? Esta acción no se puede deshacer.")) {
            onRegenerateAll();
        }
    };

    if (isLoading && !assets) { /* ... existing loading UI ... */ }
    if (error) { /* ... existing error UI ... */ }
    if (!assets) { return <div className="text-center p-4">Esperando para iniciar la generación...</div>; }

    const scenes = storyPlan?.story_structure?.narrative_arc?.flatMap(act => act.scenes) || [];
    const sceneFrames = assets.sceneFrames || [];

    return (
        <div className="animate-fade-in space-y-8">
            <div>
                <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.3: Activos de Referencia (VisDev)</h3>
                <p className="text-gray-400">Este es tu "muro de corcho" de director. Revisa, bloquea los activos perfectos, edita detalles y genera storyboards. Cuando el look sea perfecto, continúa.</p>
            </div>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {/* Character & Environment Sections (unchanged) */}
                {assets.characters?.length > 0 && (
                    <section>
                        <h4 className="text-lg font-semibold mb-3">Personajes</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {assets.characters.map(char => <AssetCard key={char.id} asset={char} onRegenerate={onRegenerateSingle} />)}
                        </div>
                    </section>
                )}
                {assets.environments?.length > 0 && (
                    <section>
                        <h4 className="text-lg font-semibold mb-3">Ambientes</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {assets.environments.map(env => <AssetCard key={env.id} asset={env} onRegenerate={onRegenerateSingle} />)}
                        </div>
                    </section>
                )}
                {assets.elements?.length > 0 && (
                    <section>
                        <h4 className="text-lg font-semibold mb-3">Elementos Clave</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {assets.elements.map(el => <AssetCard key={el.id} asset={el} onRegenerate={onRegenerateSingle} />)}
                        </div>
                    </section>
                )}

                {/* NEW: Scene Storyboard Section */}
                <section>
                    <h4 className="text-lg font-semibold mb-3">Storyboard de Escena</h4>
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-4">
                        <p className="text-sm text-gray-400">Genera una "Matriz de Progresión" para visualizar rápidamente el flujo de una escena con una sola llamada a la IA, optimizando tiempo y recursos.</p>
                        <div className="flex flex-wrap gap-2">
                            {scenes.map(scene => (
                                <button
                                    key={scene.scene_number}
                                    onClick={() => onGenerateSceneMatrix(scene.scene_number)}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-yellow-500 transition-colors disabled:bg-yellow-800 text-sm"
                                >
                                    <SparkleIcon className="w-4 h-4" />
                                    Generar Matriz Escena {scene.scene_number}
                                </button>
                            ))}
                        </div>
                        {sceneFrames.length > 0 ? (
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-gray-700/50">
                                {sceneFrames.map(frame => <AssetCard key={frame.id} asset={frame} onRegenerate={onRegenerateSingle} />)}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-6">Los fotogramas del storyboard aparecerán aquí.</div>
                        )}
                    </div>
                </section>
            </div>
            
            <div className="pt-6 border-t border-gray-700 flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={handleRegenerateClick} 
                    disabled={isLoading}
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
                >
                    🔄 Regenerar Todos los Activos
                </button>
                <button 
                    onClick={onContinue} 
                    disabled={isLoading}
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
                >
                    ▶️ Generar Videos
                </button>
            </div>
        </div>
    );
};

export default ReferenceAssetView;