/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// FIX: Imported `useMemo` hook from React.
import React, { useRef, useMemo, useState, useEffect } from 'react';
import type { GeneratedReferenceAssets, ReferenceAsset, StoryMasterplan, Scene } from '@/components/story-builder/types';
import Spinner from '@/components/Spinner';
import { XCircleIcon, UploadIcon, DownloadIcon, DeviceHardDiskIcon } from '@/components/icons';
import { imageBlobCache } from '@/services/imageBlobCache';

interface ReferenceAssetViewProps {
    isLoading: boolean;
    loadingScenes: Record<string, boolean>;
    assets: GeneratedReferenceAssets | null;
    error: string | null;
    storyPlan: StoryMasterplan | null;
    generationProgress: { current: number; total: number; message: string; } | null;
    onContinue: () => void;
    onRegenerate: (aspectRatio: ReferenceAsset['aspectRatio']) => void;
    onGenerateFrameForScene: (scene: Scene, frameType: 'start' | 'climax' | 'end') => void;
    onUpdateAsset: (id: string, instruction: string) => void;
    onDeleteAsset: (id: string) => void;
    onUploadAsset: (type: 'character' | 'environment' | 'element', file: File) => void;
    aspectRatio: ReferenceAsset['aspectRatio'];
    setAspectRatio: (ratio: ReferenceAsset['aspectRatio']) => void;
    onExportProject: () => void;
    onSaveLocally: () => void;
    onCancelGeneration: () => void;
}

interface EditableAssetCardProps {
    asset: ReferenceAsset;
    onUpdate: (id: string, instruction: string) => void;
    onDelete: (id: string) => void;
}
const EditableAssetCard: React.FC<EditableAssetCardProps> = ({ asset, onUpdate, onDelete }) => {
    const [imageUrl, setImageUrl] = useState<string>('');
    
    useEffect(() => {
        let url = '';
        const blob = imageBlobCache.get(asset.id);
        if (blob) {
            url = URL.createObjectURL(blob);
            setImageUrl(url);
        }
        return () => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [asset.id]);

    const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
    };

    return (
        <div className="bg-gray-900/50 rounded-lg overflow-hidden border border-gray-700 flex flex-col">
            <div className="relative group">
                {imageUrl ? (
                    <img src={imageUrl} alt={asset.name} className="w-full h-48 object-cover" />
                ) : (
                    <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
                        <Spinner className="w-8 h-8 animate-spin" />
                    </div>
                )}
                <a 
                    href={imageUrl}
                    download={`${asset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`}
                    onClick={handleDownload}
                    className="absolute top-1 left-1 bg-blue-600/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500"
                    title="Descargar este activo"
                    aria-label="Descargar este activo"
                >
                    <DownloadIcon className="w-5 h-5" />
                </a>
                <button 
                    onClick={() => onDelete(asset.id)}
                    className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    title="Eliminar este activo"
                >
                    <XCircleIcon className="w-5 h-5" />
                </button>
                 <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                    {asset.aspectRatio}
                </div>
            </div>
            <div className="p-3 flex flex-col flex-grow">
                <h5 className="font-bold text-gray-200">{asset.name}</h5>
                <p className="text-xs text-gray-400 mt-1 italic truncate" title={asset.prompt}>{asset.source === 'user' ? 'Subido por el usuario' : asset.prompt}</p>
                <textarea
                    value={asset.instruction || ''}
                    onChange={(e) => onUpdate(asset.id, e.target.value)}
                    placeholder="Añadir indicación para la IA..."
                    rows={2}
                    className="mt-2 w-full bg-gray-800 border border-gray-600 rounded-md p-1.5 text-xs text-gray-300 resize-none focus:ring-1 focus:ring-blue-500"
                />
            </div>
        </div>
    );
};

interface AssetSectionProps {
    title: string;
    assets: ReferenceAsset[];
    type: 'character' | 'environment' | 'element';
    onUpdateAsset: (id: string, instruction: string) => void;
    onDeleteAsset: (id: string) => void;
    onUploadAsset: (type: 'character' | 'environment' | 'element', file: File) => void;
}
const AssetSection: React.FC<AssetSectionProps> = ({ title, assets, type, onUpdateAsset, onDeleteAsset, onUploadAsset }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUploadAsset(type, e.target.files[0]);
        }
        if (e.target) e.target.value = ''; // Reset input to allow re-uploading the same file
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-xl font-semibold text-blue-300">{title}</h4>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-white/10 text-white font-semibold py-1 px-3 rounded-lg hover:bg-white/20 transition-colors text-sm"
                >
                    <UploadIcon className="w-4 h-4" />
                    Añadir
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
            {assets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {assets.map(asset => (
                        <EditableAssetCard 
                            key={asset.id} 
                            asset={asset}
                            onUpdate={onUpdateAsset}
                            onDelete={onDeleteAsset}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm">No se han generado o añadido activos para esta categoría.</p>
            )}
        </div>
    );
};


const ReferenceAssetView: React.FC<ReferenceAssetViewProps> = ({ 
    isLoading, assets, error, onContinue, onRegenerate, onUpdateAsset, onDeleteAsset, onUploadAsset, 
    aspectRatio, setAspectRatio, onExportProject, storyPlan, onGenerateFrameForScene, loadingScenes, onSaveLocally, generationProgress,
    onCancelGeneration
}) => {
    const [localError, setLocalError] = useState<string | null>(null);

    useEffect(() => {
        setLocalError(error);
    }, [error]);

    const aspectRatios: { label: string, value: ReferenceAsset['aspectRatio'] }[] = [
        { label: 'Vertical', value: '9:16' },
        { label: 'Cuadrado', value: '1:1' },
        { label: 'Horizontal', value: '16:9' },
        { label: 'Post', value: '4:5' },
    ];

    const allScenes = useMemo(() => storyPlan?.story_structure?.narrative_arc?.flatMap(act => act?.scenes || []).filter(Boolean) || [], [storyPlan]);

    if (isLoading && (!assets || (assets.characters.length === 0 && assets.environments.length === 0 && !generationProgress))) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="text-gray-400 mt-4">Generando activos de referencia iniciales...</p>
                <p className="text-sm text-gray-500">Esto es mucho más rápido y evita límites de API.</p>
            </div>
        );
    }
    
    const initialAssetGenFailed = !assets || (assets.characters.length === 0 && assets.environments.length === 0 && assets.elements.length === 0);

    if (localError && initialAssetGenFailed) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en la Generación de Referencias</h3>
                <p className="mb-1 text-sm">La IA no pudo generar los activos visuales. Esto puede ocurrir si el plan de historia es muy abstracto o si hubo un problema de conexión.</p>
                <p className="mb-4 bg-red-900/20 p-2 rounded-md text-xs font-mono">{localError}</p>
                <button onClick={() => { setLocalError(null); onRegenerate(aspectRatio); }} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">
                    🔄 Regenerar
                </button>
            </div>
        )
    }
    
    if (!isLoading && initialAssetGenFailed) {
        return (
             <div className="text-center text-yellow-400 bg-yellow-500/10 p-6 rounded-lg border border-yellow-500/20">
                <h3 className="font-bold text-lg mb-2">⚠️ No se han generado activos</h3>
                <p className="mb-4">La IA no generó activos de referencia. Puedes intentar regenerarlos o subir los tuyos manualmente para continuar.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => onRegenerate(aspectRatio)} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg">
                        🔄 Regenerar
                    </button>
                    <button 
                        onClick={onContinue}
                        className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors"
                    >
                        ▶️ Continuar con Activos Manuales
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.3: Activos de Referencia</h3>
            <p className="text-gray-400 mb-6">Estos son los activos visuales clave. Se usarán como referencia para mantener la consistencia en los videos. Añade notas para la IA o sube tus propias imágenes para enriquecer el resultado final.</p>

            {isLoading && generationProgress && (
                <div className="mb-6 bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-blue-300">{generationProgress.message}</span>
                        <span className="text-blue-400">{generationProgress.current}/{generationProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                        />
                    </div>
                    <button
                        onClick={onCancelGeneration}
                        className="w-full mt-4 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-500 transition-colors"
                    >
                        Cancelar Generación
                    </button>
                </div>
            )}
            
            {localError && !initialAssetGenFailed && (
                 <div className="my-4 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-md">❌ Ocurrió un error en la generación:</h3>
                        <p className="text-sm font-mono">{localError}</p>
                    </div>
                    <button onClick={() => setLocalError(null)} className="p-1 rounded-full hover:bg-red-500/20">
                        <XCircleIcon className="w-6 h-6"/>
                    </button>
                </div>
            )}

            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex flex-wrap items-center justify-center gap-3 mb-6">
                <span className="font-semibold text-gray-300">Resolución de Activos:</span>
                {aspectRatios.map(ar => (
                    <button 
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        disabled={isLoading || Object.values(loadingScenes).some(v => v)}
                        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50 ${aspectRatio === ar.value ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                        {ar.label} ({ar.value})
                    </button>
                ))}
            </div>

            <div className="space-y-8 max-h-[55vh] overflow-y-auto pr-2">
                {assets && <AssetSection 
                    title="Personajes" 
                    assets={assets.characters} 
                    type="character" 
                    onUpdateAsset={onUpdateAsset} 
                    onDeleteAsset={onDeleteAsset} 
                    onUploadAsset={onUploadAsset} 
                />}
                
                {assets && <div>
                    <h4 className="text-xl font-semibold text-blue-300 mb-3">Fotogramas Clave de Escena</h4>
                    <div className="space-y-4">
                        {allScenes.map(scene => {
                            const sceneFrames = assets.sceneFrames.filter(f => f.sceneNumber === scene.scene_number);
                            const frameTypes: ('start' | 'climax' | 'end')[] = ['start', 'climax', 'end'];
                            const frameTypeLabels: Record<'start' | 'climax' | 'end', string> = {
                                start: 'Inicio',
                                climax: 'Clímax',
                                end: 'Fin'
                            };

                            return (
                                <div key={scene.scene_number} className="bg-gray-900/20 p-3 rounded-lg border border-gray-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="font-bold text-gray-300">Escena {scene.scene_number}: {scene.title}</h5>
                                        <div className="flex items-center gap-2">
                                            {frameTypes.map(frameType => {
                                                const loadingKey = `${scene.scene_number}-${frameType}`;
                                                const isLoadingFrame = loadingScenes[loadingKey];
                                                const frameExists = sceneFrames.some(f => f.frameType === frameType);

                                                if (frameExists) return null;

                                                return (
                                                    <button 
                                                        key={frameType}
                                                        onClick={() => onGenerateFrameForScene(scene, frameType)}
                                                        disabled={isLoadingFrame}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1 px-3 rounded-lg text-sm flex items-center gap-2 disabled:bg-blue-800"
                                                    >
                                                        {isLoadingFrame && <Spinner className="w-4 h-4 animate-spin"/>}
                                                        Generar {frameTypeLabels[frameType]}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {sceneFrames.length > 0 && (
                                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                            {sceneFrames.sort((a,b) => {
                                                const order = { 'start': 1, 'climax': 2, 'end': 3 };
                                                return (order[a.frameType!] || 0) - (order[b.frameType!] || 0);
                                            }).map(frame => (
                                                <EditableAssetCard key={frame.id} asset={frame} onUpdate={onUpdateAsset} onDelete={onDeleteAsset} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>}

                {assets && <AssetSection 
                    title="Ambientes" 
                    assets={assets.environments} 
                    type="environment" 
                    onUpdateAsset={onUpdateAsset} 
                    onDeleteAsset={onDeleteAsset} 
                    onUploadAsset={onUploadAsset} 
                />}
                {assets && <AssetSection 
                    title="Elementos Clave" 
                    assets={assets.elements} 
                    type="element" 
                    onUpdateAsset={onUpdateAsset} 
                    onDeleteAsset={onDeleteAsset} 
                    onUploadAsset={onUploadAsset} 
                />}
            </div>

            <div className="pt-6 border-t border-gray-700 mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button 
                    onClick={onSaveLocally}
                    disabled={isLoading || Object.values(loadingScenes).some(v => v)}
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <DeviceHardDiskIcon className="w-5 h-5"/>
                    Guardar Localmente
                </button>
                <button 
                    onClick={onExportProject}
                    disabled={isLoading || Object.values(loadingScenes).some(v => v)}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title="Descarga el proyecto completo, incluyendo imágenes y documentación, como un archivo .zip."
                >
                    <DownloadIcon className="w-5 h-5"/>
                    Descargar Proyecto (.zip)
                </button>
                <button 
                    onClick={() => onRegenerate(aspectRatio)}
                    disabled={isLoading || Object.values(loadingScenes).some(v => v)} 
                    className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    🔄 Regenerar Activos
                </button>
                <button 
                    onClick={onContinue}
                    disabled={isLoading || Object.values(loadingScenes).some(v => v)}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    ▶️ Generar Videos
                </button>
            </div>
        </div>
    );
};

export default ReferenceAssetView;