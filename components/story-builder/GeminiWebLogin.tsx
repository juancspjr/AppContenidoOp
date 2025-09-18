/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { geminiWebService } from '@/services/geminiWebService';

const MANUAL_COOKIE_INPUT_KEY = 'gemini_web_manual_cookie_input';

const GeminiWebLogin: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'checking' | 'login_required' | 'connecting' | 'ready' | 'error'>('checking');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [cookieInput, setCookieInput] = useState('');
    const [errorDetails, setErrorDetails] = useState<{
        needsCaptcha?: boolean;
        needsReauth?: boolean;
        message?: string;
    }>({});
    
    // State for Extension Integration
    const [extensionReady, setExtensionReady] = useState(false);
    const [extensionCookiesData, setExtensionCookiesData] = useState<{ totalCookies: number; status: string; cookieString: string } | null>(null);
    
    const parsedCookieString = useMemo(() => {
        const input = cookieInput.trim();
        if (!input) return null;

        let potentialCookieString = '';

        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed) && parsed.length > 0 && 'name' in parsed[0] && 'value' in parsed[0]) {
                potentialCookieString = parsed.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            }
        } catch (e) {
            // Not a JSON array
        }

        if (!potentialCookieString && input.includes('\t')) {
            potentialCookieString = input.split('\n')
                .filter(line => !line.startsWith('#') && line.trim() !== '')
                .map(line => {
                    const parts = line.split('\t');
                    return parts.length >= 7 ? `${parts[5]}=${parts[6]}` : null;
                })
                .filter(Boolean)
                .join('; ');
        }

        if (!potentialCookieString) {
            potentialCookieString = input;
        }
        
        const cookies: { [key: string]: string } = {};
        potentialCookieString.split(';').forEach(cookie => {
            const parts = cookie.match(/([^=]+)=(.*)/);
            if (parts && parts.length === 3) {
                cookies[parts[1].trim()] = parts[2].trim();
            }
        });

        const hasPsid = Object.keys(cookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSID') && !key.includes('PSIDTS') && !key.includes('PSIDCC'));
        const hasPsidTs = Object.keys(cookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSIDTS'));

        if (hasPsid && hasPsidTs) {
            return potentialCookieString;
        }

        return null;
    }, [cookieInput]);


    const handleConnectWithCookieString = useCallback(async (validCookieString: string) => {
        setIsLoading(true);
        setStatus('connecting');
        setErrorMessage('');
        setErrorDetails({});
        try {
            const success = await geminiWebService.initialize(validCookieString);
            if (success) {
                setIsInitialized(true);
                setStatus('ready');
                alert(`✅ ¡CONEXIÓN EXITOSA!\n\n🌐 Gemini Web conectado correctamente\n✨ Generación ilimitada de imágenes activada`);
            } else {
                throw new Error('La inicialización falló por una razón desconocida.');
            }
        } catch (error: any) {
            setStatus('error');
            const message = error.message || 'Error desconocido al conectar';
            setErrorMessage(message);
            if (message.includes('CAPTCHA')) setErrorDetails({ needsCaptcha: true, message });
            else if (message.includes('expirado') || message.includes('logúeate')) setErrorDetails({ needsReauth: true, message });
            else setErrorDetails({});
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const initializeService = async () => {
            setStatus('checking');
            setIsLoading(true);
            setErrorMessage('');
            setErrorDetails({});
            
            try {
                const success = await geminiWebService.loadSavedCookies();
                if (success) {
                    setIsInitialized(true);
                    setStatus('ready');
                } else {
                    setStatus('login_required');
                    const savedInput = localStorage.getItem(MANUAL_COOKIE_INPUT_KEY);
                    if (savedInput) setCookieInput(savedInput);
                }
            } catch (error: any) {
                localStorage.removeItem('gemini_web_cookies');
                setStatus('error');
                const message = error.message || 'Error al verificar sesión guardada.';
                setErrorMessage(message);
                if (message.includes('CAPTCHA')) setErrorDetails({ needsCaptcha: true, message });
                else if (message.includes('expirado') || message.includes('logúeate')) setErrorDetails({ needsReauth: true, message });
            } finally {
                setIsLoading(false);
            }
        };
        initializeService();
        
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'STORY_BUILDER_EXTENSION_READY') {
                setExtensionReady(true);
            }
            if (event.data.type === 'STORY_BUILDER_COOKIES_RESPONSE') {
                if (event.data.success) {
                    setExtensionCookiesData(event.data.data);
                    if (event.data.data.cookieString) {
                        handleConnectWithCookieString(event.data.data.cookieString);
                    } else {
                        setErrorMessage("La extensión no pudo extraer las cookies necesarias.");
                        setStatus('error');
                    }
                } else {
                    setErrorMessage(`Error desde la extensión: ${event.data.error}`);
                    setStatus('error');
                }
                setIsLoading(false);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleConnectWithCookieString]);

    const requestCookiesFromExtension = () => {
      if (!extensionReady) {
        alert('⚠️ Extensión no detectada. Asegúrate de tenerla instalada y refresca la página.');
        return;
      }
      setIsLoading(true);
      setStatus('connecting');
      window.postMessage({type: 'STORY_BUILDER_REQUEST_COOKIES'}, '*');
    };
    
    const handleConnect = async () => {
        if (!parsedCookieString) {
            setErrorMessage("El formato de las cookies no es válido o faltan cookies esenciales.");
            return;
        }
        localStorage.setItem(MANUAL_COOKIE_INPUT_KEY, cookieInput);
        await handleConnectWithCookieString(parsedCookieString);
    };
    
    const handleDisconnect = () => {
        localStorage.removeItem('gemini_web_cookies');
        localStorage.removeItem(MANUAL_COOKIE_INPUT_KEY);
        setIsInitialized(false);
        setStatus('login_required');
        setCookieInput('');
    };
    
    const getStatusDisplay = () => {
        switch (status) {
            case 'checking': return { icon: '🔍', text: 'Verificando sesión...', color: 'text-blue-400' };
            case 'login_required': return { icon: '🔐', text: 'Conexión requerida', color: 'text-yellow-400' };
            case 'connecting': return { icon: '🔄', text: 'Conectando a Gemini Web...', color: 'text-blue-400' };
            case 'ready': return { icon: '✅', text: 'Gemini Web conectado', color: 'text-green-400' };
            case 'error': return { icon: '❌', text: 'Error de conexión', color: 'text-red-400' };
            default: return { icon: '❓', text: 'Estado desconocido', color: 'text-gray-400' };
        }
    };
    
    const statusDisplay = getStatusDisplay();
    
    return (
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/50 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{statusDisplay.icon}</span>
                    <div>
                        <h3 className="font-bold text-white">🌐 Gemini Web Unlimited</h3>
                        <p className={`text-sm ${statusDisplay.color}`}>{statusDisplay.text}</p>
                    </div>
                </div>
                {isInitialized && (
                    <button onClick={handleDisconnect} className="px-4 py-2 rounded-lg text-sm bg-gray-600 hover:bg-gray-500 text-white">
                        🔌 Desconectar
                    </button>
                )}
            </div>

             {!isInitialized && status !== 'checking' && (
                <div className="mt-4 border-t border-purple-700/50 pt-4 space-y-4 animate-fade-in">
                    {extensionReady ? (
                        <div>
                            <button 
                                onClick={requestCookiesFromExtension}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-green-600 to-teal-500 text-white font-bold py-3 rounded-lg hover:from-green-500 hover:to-teal-400 transition-all shadow-lg disabled:opacity-50"
                            >
                                🔐 Conectar con Extensión (Recomendado)
                            </button>
                            {extensionCookiesData && (
                                <p className="text-xs text-green-400 mt-2 text-center">
                                    ✅ {extensionCookiesData.totalCookies} cookies encontradas - Status: {extensionCookiesData.status}
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-2 border border-dashed border-yellow-500/50 rounded-lg text-xs text-yellow-300">
                            <p>💡 Instala nuestra extensión de Chrome para una conexión automática y segura.</p>
                        </div>
                    )}

                    <details className="text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-white text-center">O conectar manualmente...</summary>
                        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                            <label htmlFor="cookie-input" className="block text-sm font-bold text-gray-200">Pega aquí tus cookies de Gemini:</label>
                            <textarea
                                id="cookie-input"
                                value={cookieInput}
                                onChange={(e) => setCookieInput(e.target.value)}
                                placeholder="Pega el array JSON, el texto Netscape o el string de cookies aquí..."
                                rows={4}
                                className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleConnect}
                                disabled={isLoading || !parsedCookieString}
                                className="w-full px-6 py-2 rounded-lg font-bold transition-all bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLoading && status === 'connecting' ? 'Conectando...' : '🔗 Conectar Manualmente'}
                            </button>
                        </div>
                    </details>
                </div>
            )}
            
            {errorMessage && (
                 <div className="mt-3 text-xs text-red-300 bg-red-900/20 rounded p-2">
                    <strong>Error:</strong> {errorMessage}
                </div>
            )}

            {status === 'error' && errorDetails.needsCaptcha && (
                <div className="mt-3 text-xs text-orange-300 bg-orange-900/20 rounded p-3">
                    <strong>🔧 CÓMO RESOLVER CAPTCHA:</strong><br/>
                    1. Abre <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a> en una nueva pestaña.<br/>
                    2. Resuelve cualquier CAPTCHA que aparezca y asegúrate de que la página cargue.<br/>
                    3. Vuelve aquí y conéctate nuevamente.
                </div>
            )}

            {status === 'error' && errorDetails.needsReauth && (
                <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 rounded p-3">
                    <strong>🔑 SESIÓN EXPIRADA:</strong><br/>
                    1. Ve a <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a> e inicia sesión.<br/>
                    2. Vuelve aquí y conéctate otra vez.
                </div>
            )}

            {status === 'ready' && (
                <div className="mt-3 text-xs text-green-300 bg-green-900/20 rounded p-2">
                    ✨ <strong>¡Sistema activo!</strong> Generación ilimitada de imágenes habilitada.
                </div>
            )}
        </div>
    );
};

export default GeminiWebLogin;
