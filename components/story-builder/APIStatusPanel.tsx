/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback } from 'react';
import { resetAllAPIs, resetSpecificAPI, listAPIStatus, getAPIStats } from '../../services/geminiService';
import type { APIKeyStatus } from '../../services/apiKeyBlacklist';

const APIStatusPanel: React.FC = () => {
    const [apis, setApis] = useState<APIKeyStatus[]>([]);
    const [stats, setStats] = useState<any | null>(null);
    
    const refreshStatus = useCallback(() => {
        const statusList = listAPIStatus();
        const apiStats = getAPIStats();
        setApis(statusList);
        setStats(apiStats);
    }, []);
    
    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, 5000); // Auto-refresh every 5 seconds
        return () => clearInterval(interval);
    }, [refreshStatus]);
    
    const handleResetAll = () => {
        if (window.confirm('¿Estás seguro de resetear el estado de TODAS las APIs? Esto limpiará el estado persistente y reactivará todas las claves.')) {
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">🔑 Estado del Pool de APIs</h3>
            
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-sm">
                    <div className="bg-gray-700/50 p-2 rounded text-center">
                        <div className="text-gray-300">Total</div>
                        <div className="text-white font-bold text-lg">{stats.total}</div>
                    </div>
                    <div className="bg-green-600/20 p-2 rounded text-center">
                        <div className="text-green-400">✅ Activas</div>
                        <div className="text-white font-bold text-lg">{stats.active}</div>
                    </div>
                    <div className="bg-red-600/20 p-2 rounded text-center">
                        <div className="text-red-400">❌ Agotadas</div>
                        <div className="text-white font-bold text-lg">{stats.quotaExhausted}</div>
                    </div>
                    <div className="bg-yellow-600/20 p-2 rounded text-center">
                        <div className="text-yellow-400">⏰ Límite Diario</div>
                        <div className="text-white font-bold text-lg">{stats.dailyLimit}</div>
                    </div>
                    <div className="bg-gray-600/20 p-2 rounded text-center">
                        <div className="text-gray-400">🚫 Bloqueadas</div>
                        <div className="text-white font-bold text-lg">{stats.permanentlyBlocked}</div>
                    </div>
                </div>
            )}
            
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4 pr-2 border-t border-b border-gray-700 py-2">
                {apis.map(api => {
                    const statusConfig = {
                        'active': { icon: '✅', color: 'text-green-400', bg: 'bg-green-900/20' },
                        'quota_exhausted': { icon: '❌', color: 'text-red-400', bg: 'bg-red-900/20' },
                        'daily_limit': { icon: '⏰', color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
                        'permanently_blocked': { icon: '🚫', color: 'text-gray-400', bg: 'bg-gray-700/30' }
                    }[api.status];
                    
                    return (
                        <div key={api.id} className={`flex items-center justify-between p-2 rounded ${statusConfig.bg}`}>
                            <div className="flex items-center gap-3">
                                <span title={api.status}>{statusConfig.icon}</span>
                                <span className="text-white font-mono text-sm">{api.projectName}</span>
                                {api.failureCount > 0 && (
                                    <span className="text-xs bg-red-800/50 text-red-300 px-2 py-0.5 rounded-full" title={`Número de fallos consecutivos: ${api.failureCount}`}>
                                        {api.failureCount} fallos
                                    </span>
                                )}
                            </div>
                            {api.status !== 'active' && (
                                <button
                                    onClick={() => handleResetSpecific(api.projectName)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
                                    title={`Reactivar la API ${api.projectName}`}
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="flex gap-2 justify-end">
                <button
                    onClick={refreshStatus}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm"
                >
                    🔄 Actualizar
                </button>
                <button
                    onClick={handleResetAll}
                    className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                >
                    💥 Resetear Todo
                </button>
            </div>
        </div>
    );
};

export default APIStatusPanel;