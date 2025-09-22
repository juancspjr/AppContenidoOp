/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { StoryMasterplan, ReferenceAssets, ProgressUpdate, ReferenceAsset } from './types';
import Spinner from '../Spinner';
import { assetDBService } from '../../services/assetDBService';
import { logger } from '../../utils/logger';

interface ReferenceAssetViewProps {
    isLoading: boolean;
    progress: Record<string, ProgressUpdate>;
    assets: ReferenceAssets | null;
    error: string | null;
    onRegenerateAll: () => void;
    onRegenerateSingle: (asset: ReferenceAsset) => void;
    onContinue: () => void;
    onGoToPhase: (phase: number) => void;
}

const AssetCard: React.FC<{ asset: ReferenceAsset, onRegenerate: (asset: ReferenceAsset) => void }> = ({ asset, onRegenerate }) => {
    const [imageUrl, setImageUrl] = React.useState('');
    const { assetId, name, description, generationStatus } = asset;

    React.useEffect(() => {
        let objectUrl: string | null = null;
        const loadImage = async () => {
            if (!assetId) return;
            const blob = await assetDBService.loadAsset(assetId);
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setImageUrl(objectUrl);
            } else {
                logger.log('WARNING', 'AssetCard', `Blob not found in cache for assetId: ${assetId}`);
            }
        };
        
        loadImage();
        
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [assetId]);

    const isGenerating = generationStatus === 'generating';

    return (
        <div className="bg-gray-800 rounded-lg p-3 relative group">
            <div className="w-full aspect-square bg-gray-700 rounded flex items-center justify-center">
                {isGenerating || !imageUrl ? (
                    <Spinner className="w-8 h-8"/>
                ) : (
                    <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded" />
                )}
            </div>
            <h5 className="font-bold mt-2 truncate">{name}</h5>
            <p className="text-xs text-gray-400 h-8 overflow-hidden">{description}</p>
            {!isGenerating &&
                 <button 
                    onClick={() => onRegenerate(asset)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Regenerar este activo"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.899 2.186l-1.002.501a5.999 5.999 0 00-10.05-1.932V5a1 1 0 01-2 0V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.899-2.186l1.002-.501a5.999 5.999 0 0010.05 1.932V15a1 1 0 012 0v2a1 1 0 01-1 1z" clipRule="evenodd" />
                    </svg>
                </button>
            }
        </div>
    );
};


const ReferenceAssetView: React.FC<ReferenceAssetViewProps> = ({
    isLoading,
    progress,
    assets,
    error,
    onRegenerateAll,
    onRegenerateSingle,
    onContinue,
    onGoToPhase,
}) => {

    const handleRegenerateClick = () => {
        if (window.confirm("¿Estás seguro de que quieres regenerar todos los activos de referencia? Esta acción consumirá recursos y no se puede deshacer.")) {
            onRegenerateAll();
        }
    };
    
    if (isLoading && !assets) {
        return (
            <div className="text-center py-8 animate-fade-in">
                <Spinner className="animate-spin h-16 w-16 text-white mx-auto" />
                <h3 className="text-2xl font-bold mt-4 text-blue-300">Fase 6.3: Generando Activos de Referencia</h3>
                <p className="text-gray-400 mt-2">Nuestros agentes de IA están creando las imágenes de referencia para tus personajes y entornos. Esto asegura la consistencia visual en toda tu historia.</p>
                <div className="mt-4 text-sm text-gray-300 bg-gray-900/50 p-3 rounded-lg">
                    <p>{progress['reference_assets']?.message || 'Iniciando...'}</p>
                    {progress['reference_assets']?.progress !== undefined && (
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress['reference_assets'].progress}%` }}></div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-6 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">❌ Error en la Generación de Referencias</h3>
                <p className="mb-4">{error}</p>
                 <div className="flex justify-center gap-4">
                     <button onClick={() => onGoToPhase(4)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Volver al Plan</button>
                    <button onClick={handleRegenerateClick} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">Reintentar Generación</button>
                </div>
            </div>
        )
    }

    if (!assets) {
         return <div className="text-center p-4">Esperando para iniciar la generación de activos de referencia...</div>;
    }

    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold mb-2 text-green-400">Fase 6.3: Activos de Referencia Generados</h3>
            <p className="text-gray-400 mb-6">Estos son los activos visuales clave que la IA usará para mantener la coherencia. Si no estás satisfecho, puedes volver a generarlos. Si te gustan, continúa para generar el video final.</p>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                    <h4 className="text-lg font-semibold mb-3">Personajes</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {assets.characters.map(char => <AssetCard key={char.id} asset={char} onRegenerate={onRegenerateSingle} />)}
                    </div>
                </div>
                {assets.environments.length > 0 && <div>
                    <h4 className="text-lg font-semibold mb-3">Entornos</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {assets.environments.map(env => <AssetCard key={env.id} asset={env} onRegenerate={onRegenerateSingle} />)}
                    </div>
                </div>}
                 {assets.elements.length > 0 && <div>
                    <h4 className="text-lg font-semibold mb-3">Elementos Clave</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {assets.elements.map(el => <AssetCard key={el.id} asset={el} onRegenerate={onRegenerateSingle} />)}
                    </div>
                </div>}
            </div>
            
            <div className="pt-6 border-t border-gray-700 mt-6 flex flex-col sm:flex-row gap-4">
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
                    ▶️ Continuar a la Generación de Video
                </button>
            </div>
        </div>
    );
};

export default ReferenceAssetView;