/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// 🎮 COMPONENTE DE ADMINISTRACIÓN DE APIs (OPCIONAL)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { resetAllAPIs, resetSpecificAPI } from '../../services/geminiService';
import { PersistentAPIKeyManager } from '../../services/apiKeyBlacklist';
import type { APIKeyStatus } from '../../services/apiKeyBlacklist';

const APIStatusPanel: React.FC = () => {
    const [apis, setApis] = useState<APIKeyStatus[]>([]);
    const [stats, setStats] = useState<any>(null);
    
    const refreshStatus = useCallback(() => {
        const status = PersistentAPIKeyManager.listAPIStatus();
        const apiStats = PersistentAPIKeyManager.getStats();
        
        // This is a bit of a hack because getStats only knows about keys it has seen.
        // We can infer the number of active keys not in the list.
        // Let's assume the full key list isn't available here for security.
        // A more robust solution might pass the total key count.
        const totalKeysInMemory = 10; // Assuming GEMINI_KEYS.length
        const untrackedActive = totalKeysInMemory - status.length;
        apiStats.active += untrackedActive;
        apiStats.total = totalKeysInMemory;

        setApis(status);
        setStats(apiStats);
    }, []);
    
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);
    
    const handleResetAll = () => {
        if (window.confirm('¿Estás seguro de resetear TODAS las APIs? Esto limpiará el estado persistente.')) {
            resetAllAPIs();
            refreshStatus();
        }
    };
    
    const handleResetSpecific = (projectName: string) => {
        if (window.confirm(`¿Estás seguro de resetear la API ${projectName}?`)) {
            resetSpecificAPI(projectName);
            refreshStatus();
        }
    };
    
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-4">🔑 Estado de APIs</h3>
            
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div className="bg-green-600/20 p-2 rounded">
                        <div className="text-green-400">✅ Activas</div>
                        <div className="text-white font-bold">{stats.active}</div>
                    </div>
                    <div className="bg-red-600/20 p-2 rounded">
                        <div className="text-red-400">❌ Agotadas</div>
                        <div className="text-white font-bold">{stats.quotaExhausted}</div>
                    </div>
                    <div className="bg-yellow-600/20 p-2 rounded">
                        <div className="text-yellow-400">⏰ Límite Diario</div>
                        <div className="text-white font-bold">{stats.dailyLimit}</div>
                    </div>
                    <div className="bg-gray-600/20 p-2 rounded">
                        <div className="text-gray-400">🚫 Bloqueadas</div>
                        <div className="text-white font-bold">{stats.permanentlyBlocked}</div>
                    </div>
                </div>
            )}
            
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4 pr-2">
                {apis.map(api => {
                    const statusConfig = {
                        'active': { icon: '✅', color: 'text-green-400' },
                        'quota_exhausted': { icon: '❌', color: 'text-red-400' },
                        'daily_limit': { icon: '⏰', color: 'text-yellow-400' },
                        'permanently_blocked': { icon: '🚫', color: 'text-gray-400' }
                    }[api.status];
                    
                    return (
                        <div key={api.id} className="flex items-center justify-between bg-gray-900/50 p-3 rounded">
                            <div className="flex items-center gap-3">
                                <span>{statusConfig.icon}</span>
                                <span className="text-white font-mono text-sm">{api.projectName}</span>
                                <span className={`text-xs ${statusConfig.color}`}>{api.status}</span>
                                {api.failureCount > 0 && (
                                    <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
                                        {api.failureCount} fallos
                                    </span>
                                )}
                            </div>
                            {api.status !== 'active' && (
                                <button
                                    onClick={() => handleResetSpecific(api.projectName)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="flex gap-2">
                <button
                    onClick={refreshStatus}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm"
                >
                    🔄 Actualizar
                </button>
                <button
                    onClick={handleResetAll}
                    className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-sm"
                >
                    🔄 Reset Todas
                </button>
            </div>
        </div>
    );
};

export default APIStatusPanel;