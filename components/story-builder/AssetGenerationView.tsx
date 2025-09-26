/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
// FIX: Correctly import the `FinalAssets` type.
import type { StoryMasterplan, FinalAssets, ProgressUpdate, StoryboardPanel } from './types';
import Spinner from '../Spinner';
import { DownloadIcon, ExportIcon } from '../icons';
import { assetDBService } from '../../services/assetDBService';
import { projectPersistenceService } from '../../services/projectPersistenceService';
import { logger } from '../../utils/logger';
import { formatApiError } from '../../utils/errorUtils';

interface ProductionDashboardProps {
    isLoading: boolean;
    progress: Record<string, ProgressUpdate>;
    assets: FinalAssets | null;
    storyboardAssets: StoryboardPanel[] | null; // Use storyboard assets as the source
    error: string | null;
    storyPlan: StoryMasterplan | null;
    onGenerate: (selectedScenes: Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>) => void;
    onGoToPhase: (phase: number) => void;
    onExit: () => void;
}

// --- Componentes Internos ---

// Componente para mostrar el activo final (video, imagen animada, etc.)
const FinalAssetDisplay: React.FC<{ assetId: string; assetType: 'video' | 'animated_image' | 'static_image'; assetName: string }> = ({ assetId, assetType, assetName }) => {
    const [assetUrl, setAssetUrl] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let url = '';
        const loadAsset = async () => {
            setIsLoading(true);
            try {
                const blob = await assetDBService.loadAsset(assetId);
                if (blob) {
                    url = URL.createObjectURL(blob);
                    setAssetUrl(url);
                }
            } catch (err) {
                 logger.log('ERROR', 'FinalAssetDisplay', `Failed to load blob for assetId: ${assetId}`, err);
            } finally {
                setIsLoading(false);
            }
        };
        loadAsset();
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [assetId]);

    if (isLoading) {
        return <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center"><Spinner /></div>;
    }

    if (!assetUrl) {
         return <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center text-red-400">Activo no encontrado</div>;
    }

    switch (assetType) {
        case 'video':
            return <video src={assetUrl} controls className="w-full rounded-lg bg-black aspect-video" />;
        case 'animated_image':
            return <img src={assetUrl} alt={assetName} className="w-full rounded-lg object-cover aspect-video ken-burns-effect" />;
        case 'static_image':
            return <img src={assetUrl} alt={assetName} className="w-full rounded-lg object-cover aspect-video" />;
        default:
            return null;
    }
};

// Componente para una tarjeta de producción de escena individual
const ProductionCard: React.FC<{
    // FIX: Access nested scenes array correctly.
    scene: StoryMasterplan['story_structure']['narrative_arc'][0]['scenes'][0];
    storyboardPanel: StoryboardPanel | undefined;
    finalAsset: FinalAssets['assets'][0] | undefined;
    isSelected: boolean;
    onSelectionChange: (selected: boolean) => void;
    onModeChange: (mode: 'veo' | 'ken_burns' | 'static') => void;
    onNotesChange: (notes: string) => void;
    currentMode: 'veo' | 'ken_burns' | 'static';
    currentNotes: string;
    isLoading: boolean;
}> = ({ scene, storyboardPanel, finalAsset, isSelected, onSelectionChange, onModeChange, onNotesChange, currentMode, currentNotes, isLoading }) => {
    const [storyboardUrl, setStoryboardUrl] = React.useState('');

    React.useEffect(() => {
        let url = '';
        // FIX: Correctly access the `assetId` property on the `storyboardPanel` object.
        if (storyboardPanel?.assetId) {
            assetDBService.loadAsset(storyboardPanel.assetId).then(blob => {
                if (blob) {
                    url = URL.createObjectURL(blob);
                    setStoryboardUrl(url);
                }
            });
        }
        return () => { if(url) URL.revokeObjectURL(url) };
    // FIX: Correctly access the `assetId` property on the `storyboardPanel` object.
    }, [storyboardPanel?.assetId]);
    
    return (
        <div className={`bg-gray-800/50 rounded-lg p-4 border-2 transition-colors ${isSelected ? 'border-blue-500' : 'border-transparent'}`}>
            <div className="flex items-start gap-4">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectionChange(e.target.checked)}
                    className="mt-1.5 h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                    disabled={isLoading}
                />
                <div className="flex-grow">
                    <h4 className="font-bold text-lg text-white">Escena {scene.scene_number}: {scene.title}</h4>
                    <p className="text-sm text-gray-400">{scene.summary}</p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Visuals Column */}
                <div className="w-full aspect-video bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                   {finalAsset ? (
                       <FinalAssetDisplay assetId={finalAsset.assetId} assetType={finalAsset.type} assetName={scene.title} />
                   ) : storyboardUrl ? (
                        <img src={storyboardUrl} alt={`Storyboard: ${scene.title}`} className="w-full h-full object-cover"/>
                   ) : (
                       <div className="text-xs text-gray-400 p-2 text-center">Panel de storyboard no encontrado.</div>
                   )}
                </div>

                {/* Controls Column */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Modo de Generación</label>
                        <select
                            value={currentMode}
                            onChange={(e) => onModeChange(e.target.value as any)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm"
                            disabled={isLoading}
                        >
                            <option value="veo">Video Completo (VEO)</option>
                            <option value="ken_burns">Imagen Animada (Ken Burns)</option>
                            <option value="static">Imagen Estática</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Indicaciones de Video</label>
                        <textarea
                            value={currentNotes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            rows={3}
                            placeholder="Ej: 'Añade un movimiento lento de cámara hacia la derecha'"
                            className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm resize-none"
                            disabled={isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Componente Principal ---

const AssetGenerationView: React.FC<ProductionDashboardProps> = ({
    isLoading, progress, assets, storyboardAssets, error, storyPlan,
    onGenerate, onGoToPhase, onExit
}) => {
    const [selectedScenes, setSelectedScenes] = React.useState<Set<number>>(new Set());
    const [sceneChoices, setSceneChoices] = React.useState<Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>>(new Map());

    // FIX: Correctly access the `narrative_arc` from the `story_structure` property.
    const scenes = storyPlan?.story_structure?.narrative_arc?.flatMap(act => act?.scenes || []).filter(Boolean) || [];

    // Initialize choices
    React.useEffect(() => {
        const initialChoices = new Map<number, { mode: 'veo' | 'ken_burns' | 'static'; notes: string }>();
        scenes.forEach(scene => {
            initialChoices.set(scene.scene_number, { mode: 'veo', notes: '' });
        });
        setSceneChoices(initialChoices);
        setSelectedScenes(new Set(scenes.map(s => s.scene_number)));
    // FIX: Only run this effect when the storyPlan changes to avoid re-initializing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storyPlan]);

    const handleSelectionChange = (sceneNumber: number, isSelected: boolean) => {
        setSelectedScenes(prev => {
            const newSet = new Set(prev);
            if (isSelected) newSet.add(sceneNumber);
            else newSet.delete(sceneNumber);
            return newSet;
        });
    };

    const handleChoiceChange = (sceneNumber: number, key: 'mode' | 'notes', value: any) => {
        setSceneChoices(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(sceneNumber) || { mode: 'veo' as const, notes: '' };
            // FIX: Explicitly cast 'current' to the expected type to resolve a TypeScript compilation error
            // where it was being inferred as 'unknown'.
            const currentChoice = current as { mode: 'veo' | 'ken_burns' | 'static', notes: string };
            const newChoice = { ...currentChoice, [key]: value };
            newMap.set(sceneNumber, newChoice);
            return newMap;
        });
    };
    
    const handleGenerateClick = () => {
        const choicesToGenerate = new Map();
        selectedScenes.forEach(sceneNumber => {
            if (sceneChoices.has(sceneNumber)) {
                choicesToGenerate.set(sceneNumber, sceneChoices.get(sceneNumber));
            }
        });
        if (choicesToGenerate.size > 0) {
            onGenerate(choicesToGenerate);
        } else {
            alert("Por favor, selecciona al menos una escena para generar.");
        }
    };
    
    const handleExport = async () => {
        try {
            await projectPersistenceService.exportProjectWithAssets();
        } catch (e) {
            alert(`Error exportando proyecto: ${formatApiError(e)}`);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                 <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.4: Ensamblaje Final</h3>
                <p className="text-gray-400">¡Luz, cámara, IA! Selecciona las escenas que quieres producir, elige el modo de generación y añade tus notas de director. La IA usará los paneles del storyboard para garantizar la coherencia visual.</p>
            </div>
            
            {error && (
                 <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                    <h3 className="font-bold">❌ Error en la Generación</h3>
                    <p className="text-sm">{formatApiError(error)}</p>
                </div>
            )}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {scenes.map(scene => {
                    const finalAsset = assets?.assets.find(a => a.sceneId === `scene_${scene.scene_number}`);
                    // FIX: Correctly access the `sceneNumber` property on the `storyboardPanel` object.
                    const storyboardPanel = storyboardAssets?.find(p => p.sceneNumber === scene.scene_number);
                    const choices = sceneChoices.get(scene.scene_number) || { mode: 'veo', notes: '' };

                    return (
                        <ProductionCard
                            key={scene.scene_number}
                            scene={scene}
                            storyboardPanel={storyboardPanel}
                            finalAsset={finalAsset}
                            isSelected={selectedScenes.has(scene.scene_number)}
                            onSelectionChange={(sel) => handleSelectionChange(scene.scene_number, sel)}
                            onModeChange={(mode) => handleChoiceChange(scene.scene_number, 'mode', mode)}
                            onNotesChange={(notes) => handleChoiceChange(scene.scene_number, 'notes', notes)}
                            currentMode={choices.mode}
                            currentNotes={choices.notes}
                            isLoading={isLoading}
                        />
                    );
                })}
            </div>
            
             <div className="pt-6 border-t border-gray-700 flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={handleExport}
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
                >
                    <ExportIcon className="w-5 h-5"/>
                    Exportar Proyecto y Activos (.zip)
                </button>
                 <button 
                    onClick={handleGenerateClick}
                    disabled={isLoading || selectedScenes.size === 0}
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:bg-green-800 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Generando...' : `Generar ${selectedScenes.size} Escena(s) Seleccionada(s)`}
                </button>
            </div>
             <div className="text-center">
                 <button onClick={onExit} className="text-gray-400 hover:text-white text-sm">Finalizar y Salir</button>
            </div>

        </div>
    );
};

export default AssetGenerationView;