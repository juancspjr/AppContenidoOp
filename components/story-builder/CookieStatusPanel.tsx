/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

export type CookieStatus = 'loading' | 'ready' | 'failed' | 'manual_required';

interface CookieStatusPanelProps {
    status: CookieStatus;
    onLogin: () => void;
}

const CookieStatusPanel: React.FC<CookieStatusPanelProps> = ({ status, onLogin }) => {
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-3">
                {status === 'loading' && (
                    <>
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        <span className="text-sm text-blue-400">Inicializando sistema de cookies...</span>
                    </>
                )}
                {status === 'ready' && (
                    <>
                        <span className="text-green-400">✅</span>
                        <span className="text-sm text-green-400">Fallback de Gemini Web activo</span>
                    </>
                )}
                {status === 'manual_required' && (
                    <>
                        <span className="text-yellow-400">⚠️</span>
                        <span className="text-sm text-yellow-400">Se requiere login manual</span>
                        <button 
                            onClick={onLogin}
                            className="ml-3 bg-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-500 transition-colors"
                        >
                            🔐 Completar Login
                        </button>
                    </>
                )}
                {status === 'failed' && (
                    <>
                        <span className="text-red-400">❌</span>
                        <span className="text-sm text-red-400">Error en el sistema de cookies (requiere backend)</span>
                    </>
                )}
            </div>
        </div>
    );
};

export default CookieStatusPanel;