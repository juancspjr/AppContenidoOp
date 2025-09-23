/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { PersistentAPIKeyManager, type APIKeyStatus, type APIKeyData } from '../../services/persistentApiKeyManager';

type KeyStatusDisplay = APIKeyData & APIKeyStatus;

const APIStatusPanel: React.FC = () => {
    const [keyStatuses, setKeyStatuses] = useState<KeyStatusDisplay[]>(PersistentAPIKeyManager.getAllKeyStatuses());

    useEffect(() => {
        const unsubscribe = PersistentAPIKeyManager.subscribe(() => {
            setKeyStatuses(PersistentAPIKeyManager.getAllKeyStatuses());
        });
        return () => unsubscribe();
    }, []);

    const getStatusIndicator = (status: 'available' | 'exhausted') => {
        const color = status === 'available' ? 'bg-green-500' : 'bg-red-500';
        return <div className={`w-3 h-3 rounded-full animate-pulse ${color}`} title={`Status: ${status}`}></div>;
    };

    const handleResetAll = () => {
        if (window.confirm("Are you sure you want to reset all API key statuses? This will make all exhausted keys available again.")) {
            PersistentAPIKeyManager.resetAllKeyStatus();
        }
    }
    
    const hasPlaceholderKeys = keyStatuses.some(k => k.api_key.startsWith('YOUR_API_KEY_HERE'));

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            {hasPlaceholderKeys && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-300 text-sm p-3 rounded-md mb-4 animate-pulse">
                    <h4 className="font-bold">⚠️ ¡ACCIÓN REQUERIDA!</h4>
                    <p>El sistema está usando claves de API de marcador de posición. La generación de IA fallará. Por favor, edita el archivo <code className="bg-black/50 px-1 rounded">config/secure_config.ts</code> y añade tus claves de API reales.</p>
                </div>
            )}
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white">Estado de Claves API</h3>
                 <button onClick={handleResetAll} className="text-xs bg-red-800 px-3 py-1 rounded hover:bg-red-700 text-red-200">
                    Resetear Estados
                </button>
            </div>
            <div className="space-y-2">
                {keyStatuses.map(key => (
                    <div key={key.id} className="bg-gray-900/50 p-2 rounded-md text-sm">
                        <div className="flex items-center gap-3">
                            {getStatusIndicator(key.status)}
                            <span className="flex-grow font-medium text-gray-300">{key.projectName}</span>
                        </div>
                        {key.status === 'exhausted' && key.cooldownUntil && (
                            <div className="text-xs text-yellow-400 pl-6 mt-1">
                                En cooldown hasta: {new Date(key.cooldownUntil).toLocaleTimeString()}
                            </div>
                        )}
                         {key.lastError && (
                            <div className="text-xs text-red-400 pl-6 mt-1 truncate" title={key.lastError}>
                                Error: {key.lastError}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default APIStatusPanel;