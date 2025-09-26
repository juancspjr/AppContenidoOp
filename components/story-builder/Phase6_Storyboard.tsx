/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { StoryMasterplan, StoryboardPanel, ReferenceAsset } from './types';
import Spinner from '../Spinner';
import { assetDBService } from '../../services/assetDBService';
import { logger } from '../../utils/logger';
import { SparkleIcon } from '../icons';
import { formatApiError } from '../../utils/errorUtils';

interface Phase6_StoryboardProps {
    isLoading: boolean;
    storyboardAssets: StoryboardPanel[] | null;
    characterAssets: ReferenceAsset[] | null;
    error: string | null;
    storyPlan: StoryMasterplan | null;
    onGenerateCharacters: () => void;
    onGenerateStoryboard: (aspectRatio: string) => void;
    onRegeneratePanel: (panel: StoryboardPanel, instruction?: string) => void;
    onContinue: () => void;
}

const aspectRatios = {
    "16:9": { label: "Horizontal (16:9)", value: "16:9" },
    "9:16": { label: "Vertical (9:16)", value: "9:16" },
    "1:1": { label: "Cuadrado (1:1)", value: "1:1" },
    "4:5": { label: "Retrato (4:5)", value: "4:5" }
};

type AspectRatioKey = keyof typeof aspectRatios;

const CharacterReferenceCard: React.FC<{ asset: ReferenceAsset }> = ({ asset }) => {
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        let objectUrl: string | null = null;
        const loadImage = async () => {
            // FIX: Correctly access properties on the `asset` object.
            if (asset.assetId && asset.generationStatus === 'complete') {
                const blob = await assetDBService.loadAsset(asset.assetId);
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageUrl(objectUrl);
                }
            }
        };
        loadImage();
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [asset.assetId, asset.generationStatus]);

    return (
        <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="w-full aspect-[3/4] bg-gray-700 rounded mb-2 flex items-center justify-center overflow-hidden">
                {/* FIX: Correctly access properties on the `asset` object. */}
                {asset.generationStatus === 'generating' && <Spinner />}
                {asset.generationStatus === 'complete' && imageUrl && <img src={imageUrl} alt={asset.name} className="w-full h-full object-cover" />}
                {asset.generationStatus === 'error' && <span className="text-red-400 text-xs">Error</span>}
                 {!asset.generationStatus && <span className="text-gray-400 text-xs">Pendiente</span>}
            </div>
            {/* FIX: Correctly access properties on the `asset` object. */}
            <h5 className="font-bold text-sm text-gray-200">{asset.name}</h5>
        </div>
    );
};

const PanelCard: React.FC<{
    panel: StoryboardPanel;
    onRegenerate: (panel: StoryboardPanel, instruction?: string) => void;
}> = ({ panel, onRegenerate }) => {
    const [imageUrl, setImageUrl] = useState('');
    const [instruction, setInstruction] = useState('');

    useEffect(() => {
        let objectUrl: string | null = null;
        const loadImage = async () => {
            // FIX: Correctly access the `assetId` property.
            if (panel.assetId) {
                try {
                    const blob = await assetDBService.loadAsset(panel.assetId);
                    if (blob) {
                        objectUrl = URL.createObjectURL(blob);
                        setImageUrl(objectUrl);
                    }
                } catch (err) {
                    logger.log('ERROR', 'PanelCard', `Failed to load asset: ${panel.assetId}`, err);
                }
            }
        };
        loadImage();
        return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // FIX: Correctly access properties for dependency array.
    }, [panel.assetId, panel.generationStatus]);

    // FIX: Correctly access the `generationStatus` property.
    const isGenerating = panel.generationStatus === 'generating';

    return (
        <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2 relative group">
            <div className="w-full aspect-video bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                {isGenerating ? <Spinner className="w-8 h-8"/> :
                 imageUrl ? <img src={imageUrl} alt={`Panel for Scene ${panel.sceneNumber}`} className="w-full h-full object-cover"/> :
                 <div className="text-xs text-gray-400">Error</div>}
            </div>
            <div className="flex-grow">
                {/* FIX: Correctly access properties on the `panel` object. */}
                <h5 className="font-bold truncate text-gray-200">Escena {panel.sceneNumber}</h5>
                <p className="text-xs text-gray-400 h-8 overflow-hidden" title={panel.narrativeText}>{panel.narrativeText}</p>
            </div>
            <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                placeholder="Indicaciones para regenerar..."
                className="w-full bg-gray-900 text-xs border border-gray-600 rounded p-2"
                disabled={isGenerating}
            />
            <button
                onClick={() => onRegenerate(panel, instruction)}
                disabled={isGenerating}
                className="w-full text-xs bg-blue-600 text-white font-bold py-1.5 rounded hover:bg-blue-500 disabled:bg-blue-800"
            >
                {isGenerating ? '...' : 'Regenerar'}
            </button>
        </div>
    );
};

const Phase6_Storyboard: React.FC<Phase6_StoryboardProps> = ({
    isLoading, storyboardAssets, characterAssets, error, storyPlan, onGenerateCharacters, onGenerateStoryboard, onRegeneratePanel, onContinue
}) => {
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioKey>('16:9');
    
    // FIX: Correctly access the `generationStatus` property.
    const charactersGenerated = characterAssets && characterAssets.every(a => a.generationStatus === 'complete');
    const charactersHaveBeenInitiated = characterAssets && characterAssets.length > 0;

    if (error) {
        return (
             <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en la Generación Visual</h3>
                <p className="mb-4">{formatApiError(error)}</p>
                <button onClick={characterAssets ? () => onGenerateStoryboard(selectedAspectRatio) : onGenerateCharacters} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar</button>
            </div>
        );
    }
    
    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.3: Taller de Dirección Artística</h3>
                <p className="text-gray-400">Aquí se crean los activos visuales clave. Primero, genera las referencias de personajes para asegurar la consistencia. Luego, usa esas referencias para crear el storyboard.</p>
            </div>

            {/* Step 1: Character Generation */}
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h4 className="text-lg font-semibold mb-3 text-blue-300">Paso 1: Referencias de Personajes</h4>
                 {!charactersHaveBeenInitiated ? (
                     <div className="text-center">
                        <p className="text-sm text-gray-400 mb-4">Asegura la consistencia visual generando arte de referencia para cada personaje.</p>
                        <button 
                            onClick={onGenerateCharacters} 
                            disabled={isLoading}
                            className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
                        >
                            {isLoading ? 'Generando...' : 'Generar Arte de Personajes'}
                        </button>
                    </div>
                ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {/* FIX: Correctly access the `id` property for the key. */}
                        {characterAssets.map(charAsset => <CharacterReferenceCard key={charAsset.id} asset={charAsset} />)}
                    </div>
                )}
            </div>
            
            {/* Step 2: Storyboard Generation */}
             <div className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 transition-opacity ${!charactersGenerated ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <h4 className="text-lg font-semibold mb-3 text-blue-300">Paso 2: Taller de Storyboard</h4>
                 
                <div className="mb-4 bg-gray-900/50 p-3 rounded-lg flex flex-wrap items-center justify-center gap-3">
                    <span className="font-semibold text-gray-300">Proporción de Aspecto:</span>
                    {Object.entries(aspectRatios).map(([key, { label, value }]) => (
                         <button
                            key={key}
                            onClick={() => setSelectedAspectRatio(key as AspectRatioKey)}
                            disabled={isLoading}
                            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${selectedAspectRatio === key ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                 {storyboardAssets ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {storyboardAssets.map(panel => (
                            // FIX: Correctly access the `id` property for the key.
                            <PanelCard key={panel.id} panel={panel} onRegenerate={onRegeneratePanel} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4">
                        {isLoading && charactersGenerated ? (
                            <>
                                <Spinner />
                                <p className="mt-4 text-gray-300">Generando storyboard de 6 paneles...</p>
                            </>
                        ) : (
                             <>
                                <p className="text-sm text-gray-400 mb-4">Una vez que las referencias de personajes estén listas, genera el storyboard de 6 escenas.</p>
                                <button 
                                    onClick={() => onGenerateStoryboard(selectedAspectRatio)} 
                                    disabled={!charactersGenerated || isLoading}
                                    className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
                                >
                                    {charactersGenerated ? 'Generar Storyboard' : 'Esperando a los personajes...'}
                                </button>
                             </>
                        )}
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-gray-700 flex flex-col sm:flex-row gap-4">
                 <button 
                    onClick={() => onGenerateStoryboard(selectedAspectRatio)} 
                    disabled={isLoading || !storyboardAssets}
                    className="w-full sm:w-auto flex-grow bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <SparkleIcon className="w-5 h-5"/>
                    Regenerar Storyboard Completo
                </button>
                <button 
                    onClick={onContinue} 
                    disabled={isLoading || !storyboardAssets || storyboardAssets.length === 0}
                    className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:bg-green-800"
                >
                    Continuar al Ensamblaje Final ➡️
                </button>
            </div>
        </div>
    );
};

export default Phase6_Storyboard;