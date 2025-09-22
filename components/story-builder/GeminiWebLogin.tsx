/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import geminiWebService from '../../services/geminiWebService';
import { ExtensionConnector } from '../ExtensionConnector';

const GeminiWebLogin: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(geminiWebService.isInitialized());
    const [error, setError] = useState<string | null>(null);
    const [showConnector, setShowConnector] = useState(false);
    
    useEffect(() => {
        const interval = setInterval(async () => {
            if (geminiWebService.isInitialized()) {
                const healthy = await geminiWebService.healthCheck();
                setIsConnected(healthy);
            } else {
                setIsConnected(false);
            }
        }, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const handleConnectionSuccess = async (cookieString: string) => {
        setIsConnecting(true);
        setError(null);
        try {
            await geminiWebService.initialize(cookieString);
            setIsConnected(true);
            setShowConnector(false); // Close the modal on success
            alert('🎉 ¡Conectado con Gemini Web exitosamente!');
        } catch (err: any) {
            setError(err.message || 'Error inicializando el servicio.');
        } finally {
            setIsConnecting(false);
        }
    };
    
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
             <div className="flex flex-col gap-4">
                 <div className="flex items-center space-x-3">
                     <div className={`w-3 h-3 rounded-full animate-pulse ${
                       isConnected ? 'bg-green-500' : 
                       isConnecting ? 'bg-blue-500' : 'bg-red-500'
                     }`}></div>
                     <span className={`font-semibold ${
                       isConnected ? 'text-green-400' : 
                       isConnecting ? 'text-blue-400' : 'text-red-400'
                     }`}>
                       {isConnected ? '🟢 Modo Ilimitado Conectado' : 
                        isConnecting ? '🔵 Conectando...' :
                        '🔴 Modo Ilimitado Desconectado'}
                     </span>
                 </div>

                <button
                    onClick={() => setShowConnector(true)}
                    disabled={isConnecting || isConnected}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-500 text-white font-bold py-3 rounded-lg hover:from-green-500 hover:to-teal-400 transition-all shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                    {isConnected ? 'Conexión Activa' : '🔐 Conectar Modo Ilimitado'}
                </button>
                
                {error && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 text-sm p-3 rounded-md">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <p className="text-xs text-center text-gray-400">
                    Requiere la extensión de Chrome y una sesión activa en Gemini Web.
                </p>

                {showConnector && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <ExtensionConnector 
                            onConnectionSuccess={handleConnectionSuccess} 
                            onClose={() => setShowConnector(false)} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiWebLogin;
