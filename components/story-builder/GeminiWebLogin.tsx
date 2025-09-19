/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
// FIX: Changed to a default import as `geminiWebService.ts` provides a default export.
import geminiWebService from '@/services/geminiWebService';

const GeminiWebLogin: React.FC = () => {
    // 4. ASEGURAR que existen estos estados:
    const [extensionReady, setExtensionReady] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [cookiesData, setCookiesData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 2. AGREGAR EXACTAMENTE este useEffect al inicio del componente:
    useEffect(() => {
        console.log('🎬 APP: Configurando listeners para extensión...');

        const handleExtensionMessage = (event: MessageEvent) => {
            if (!event.data || !event.data.type || !event.data.type.startsWith('STORY_BUILDER')) {
                return;
            }

            console.log('📨 APP: Mensaje recibido:', event.data);

            if (event.data.type === 'STORY_BUILDER_EXTENSION_READY') {
                console.log('✅ APP: Extensión detectada y lista');
                setExtensionReady(true);
                setError(null);
            }

            if (event.data.type === 'STORY_BUILDER_COOKIES_RESPONSE') {
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                }
                
                console.log('🍪 APP: Respuesta de cookies recibida:', event.data);
                
                if (event.data.success) {
                    console.log('✅ APP: Conectando con geminiWebService...');
                    setCookiesData(event.data.data);
                    
                    geminiWebService.initialize(event.data.data.cookieString).then(() => {
                        setIsConnected(true);
                        setIsConnecting(false);
                        console.log('🎉 APP: Conexión exitosa con Gemini Web');
                        alert('🎉 ¡Conectado con Gemini Web exitosamente!');
                    }).catch((err: any) => {
                        console.error('❌ APP: Error conectando con Gemini Web:', err);
                        setError(err.message || 'Error inicializando el servicio.');
                        setIsConnecting(false);
                    });
                } else {
                    console.error('❌ APP: Error en cookies:', event.data.error);
                    setError(event.data.error || 'La extensión devolvió un error.');
                    setIsConnecting(false);
                }
            }
        };

        window.addEventListener('message', handleExtensionMessage);
        
        // Announce readiness to the extension so it can respond immediately if it's already loaded
        window.postMessage({ type: 'STORY_BUILDER_APP_READY' }, '*');

        return () => {
            window.removeEventListener('message', handleExtensionMessage);
        };
    }, []);

    // 3. AGREGAR función de conexión:
    const connectWithExtension = () => {
        console.log('🔌 APP: Solicitando cookies a extensión...');
        setIsConnecting(true);
        setError(null);

        window.postMessage({
            type: 'STORY_BUILDER_REQUEST_COOKIES'
        }, '*');

        // Timeout de seguridad
        connectionTimeoutRef.current = setTimeout(() => {
            if (isConnecting && !isConnected) {
                console.log('⏱️ APP: Timeout esperando respuesta de extensión');
                setError('Timeout: No se recibió respuesta de la extensión en 10 segundos');
                setIsConnecting(false);
            }
        }, 10000);
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
             <div className="flex flex-col gap-4">
                <button
                    onClick={connectWithExtension}
                    disabled={!extensionReady || isConnecting || isConnected}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-500 text-white font-bold py-4 rounded-lg hover:from-green-500 hover:to-teal-400 transition-all shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
                >
                    {isConnecting ? 'Conectando...' : isConnected ? 'Conectado' : '🔐 Conectar con Extensión'}
                </button>
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex-grow">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          isConnected ? 'bg-green-500' : 
                          isConnecting ? 'bg-blue-500' : 
                          extensionReady ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className={`font-semibold ${
                          isConnected ? 'text-green-400' : 
                          isConnecting ? 'text-blue-400' : 
                          extensionReady ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {isConnected ? '🟢 Conectado exitosamente' : 
                           isConnecting ? '🔵 Conectando...' :
                           extensionReady ? '🟡 Extensión lista para conectar' : 
                           '🔴 Extensión no detectada'}
                        </span>
                    </div>
                     {error && (
                        <div className="bg-red-900/30 border border-red-500/50 text-red-300 text-sm p-3 rounded-md">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                    <div className="text-sm space-y-2 text-gray-300 mt-3">
                        <p><strong>Estado:</strong> {isConnected ? "Conectado" : "No conectado"}</p>
                        <p><strong>Cookies detectadas:</strong> {cookiesData?.totalCookies ?? 'N/A'}</p>
                        <p><strong>Última conexión:</strong> {cookiesData?.timestamp ? new Date(cookiesData.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>
                </div>
                {!extensionReady && (
                    <div className="text-xs text-center text-gray-400 bg-gray-900/50 p-2 rounded-md">
                        <p>Asegúrate de tener la extensión <strong className="text-yellow-300">"Story Builder - Conector Gemini Web"</strong> instalada y activa en Chrome.</p>
                        <p>Si la acabas de instalar, puede que necesites recargar esta página.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeminiWebLogin;