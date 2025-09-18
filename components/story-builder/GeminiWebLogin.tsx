/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
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
    
    // Unified parsing and validation logic.
    // Returns a valid `key=value;` string if the input is correct, otherwise null.
    const parsedCookieString = useMemo(() => {
        const input = cookieInput.trim();
        if (!input) return null;

        let potentialCookieString = '';

        // 1. Try parsing as JSON array first
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed) && parsed.length > 0 && 'name' in parsed[0] && 'value' in parsed[0]) {
                potentialCookieString = parsed.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            }
        } catch (e) {
            // Not a JSON array, proceed to next format
        }

        // 2. If not parsed as JSON, try Netscape/TSV format
        if (!potentialCookieString && input.includes('\t')) {
            potentialCookieString = input.split('\n')
                .filter(line => !line.startsWith('#') && line.trim() !== '')
                .map(line => {
                    const parts = line.split('\t');
                    // Netscape format: domain, flag, path, secure, expiration, name, value
                    return parts.length >= 7 ? `${parts[5]}=${parts[6]}` : null;
                })
                .filter(Boolean)
                .join('; ');
        }

        // 3. If still no string, assume it's a raw key=value string
        if (!potentialCookieString) {
            potentialCookieString = input;
        }
        
        // Final validation for all formats on the processed string
        const cookies: { [key: string]: string } = {};
        potentialCookieString.split(';').forEach(cookie => {
            const parts = cookie.match(/([^=]+)=(.*)/); // Handle values with '='
            if (parts && parts.length === 3) {
                cookies[parts[1].trim()] = parts[2].trim();
            }
        });

        const hasPsid = Object.keys(cookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSID') && !key.includes('PSIDTS') && !key.includes('PSIDCC'));
        const hasPsidTs = Object.keys(cookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSIDTS'));

        if (hasPsid && hasPsidTs) {
            return potentialCookieString; // Success! Return the processed string.
        }

        return null; // Failed validation for all formats
    }, [cookieInput]);


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
                    console.log('✅ Sesión restaurada y validada desde localStorage.');
                } else {
                    setStatus('login_required');
                    const savedInput = localStorage.getItem(MANUAL_COOKIE_INPUT_KEY);
                    if (savedInput) {
                        setCookieInput(savedInput);
                        console.log('🍪 Datos de cookies cargados desde localStorage.');
                    }
                }
            } catch (error: any) {
                console.error('❌ Error fatal durante la carga inicial de cookies:', error);
                localStorage.removeItem('gemini_web_cookies'); // Precaution
                setStatus('error');

                const message = error.message || 'Error desconocido al verificar la sesión guardada.';
                setErrorMessage(message);

                if (message.includes('CAPTCHA')) {
                    setErrorDetails({ needsCaptcha: true, message });
                } else if (message.includes('expirado') || message.includes('logúeate')) {
                    setErrorDetails({ needsReauth: true, message });
                }
            } finally {
                setIsLoading(false);
            }
        };
        
        initializeService();
    }, []);

    const handleConnectWithCookieString = async (validCookieString: string) => {
        setIsLoading(true);
        setStatus('connecting');
        setErrorMessage('');
        setErrorDetails({});
        
        try {
            console.log('🔐 Iniciando conexión con Gemini Web usando las cookies proporcionadas...');
            
            const success = await geminiWebService.initialize(validCookieString);
            
            if (success) {
                setIsInitialized(true);
                setStatus('ready');
                
                try {
                    // Save the raw input that worked, not the processed string
                    localStorage.setItem(MANUAL_COOKIE_INPUT_KEY, cookieInput);
                    console.log('🍪 Cookies manuales guardadas en localStorage tras conexión exitosa.');
                } catch (e) {
                    console.error("No se pudieron guardar las cookies en localStorage.", e);
                }
                
                alert(`✅ ¡CONEXIÓN EXITOSA!\n\n🌐 Gemini Web conectado correctamente\n✨ Generación ilimitada de imágenes activada`);
                
            } else {
                throw new Error('La inicialización falló por una razón desconocida.');
            }
            
        } catch (error: any) {
            console.error('❌ Error en conexión:', error);
            setStatus('error');
            
            const message = error.message || 'Error desconocido al conectar';
            setErrorMessage(message);
            
            if (message.includes('CAPTCHA')) {
                setErrorDetails({ needsCaptcha: true, message });
            } else if (message.includes('expirado') || message.includes('logúeate')) {
                setErrorDetails({ needsReauth: true, message });
            } else {
                setErrorDetails({});
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleConnect = async () => {
        if (!parsedCookieString) {
            setErrorMessage("El formato de las cookies no es válido o faltan cookies esenciales.");
            return;
        }
        await handleConnectWithCookieString(parsedCookieString);
    };
    
    const handleDisconnect = () => {
        localStorage.removeItem('gemini_web_cookies');
        localStorage.removeItem(MANUAL_COOKIE_INPUT_KEY);
        setIsInitialized(false);
        setStatus('login_required');
        setCookieInput('');
        console.log('🔌 Gemini Web desconectado y cookies manuales borradas.');
    };
    
    const getStatusDisplay = () => {
        switch (status) {
            case 'checking':
                return { icon: '🔍', text: 'Verificando sesión...', color: 'text-blue-400', bg: 'bg-blue-900/20' };
            case 'login_required':
                return { icon: '🔐', text: 'Conexión requerida', color: 'text-yellow-400', bg: 'bg-yellow-900/20' };
            case 'connecting':
                return { icon: '🔄', text: 'Conectando a Gemini Web...', color: 'text-blue-400', bg: 'bg-blue-900/20' };
            case 'ready':
                return { icon: '✅', text: 'Gemini Web conectado', color: 'text-green-400', bg: 'bg-green-900/20' };
            case 'error':
                return { icon: '❌', text: 'Error de conexión', color: 'text-red-400', bg: 'bg-red-900/20' };
            default:
                return { icon: '❓', text: 'Estado desconocido', color: 'text-gray-400', bg: 'bg-gray-900/20' };
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
                
                <div className="flex gap-2">
                    {isInitialized ? (
                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 rounded-lg text-sm bg-gray-600 hover:bg-gray-500 text-white"
                        >
                            🔌 Desconectar
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={isLoading || status === 'checking' || !parsedCookieString}
                            className={`px-6 py-2 rounded-lg font-bold transition-all ${
                                (isLoading || status === 'checking' || !parsedCookieString)
                                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg'
                            }`}
                        >
                            {(isLoading || status === 'checking' || status === 'connecting') ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    {status === 'checking' ? 'Verificando...' : 'Conectando...'}
                                </div>
                            ) : (
                                '🔗 Conectar'
                            )}
                        </button>
                    )}
                </div>
            </div>

             {!isInitialized && status !== 'checking' && (
                <div className="mt-4 border-t border-purple-700/50 pt-4 space-y-2 animate-fade-in">
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

                    <details className="text-xs text-gray-400 pt-2">
                        <summary className="cursor-pointer hover:text-white">¿Cómo obtener las cookies?</summary>
                        <div className="mt-2 p-3 bg-black/20 rounded-md space-y-3">
                            <div className="font-bold text-yellow-300">Método Recomendado:</div>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Abre <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a> e inicia sesión.</li>
                                <li>Instala una extensión como <strong>"Get cookies.txt"</strong> o <strong>"EditThisCookie"</strong> en tu navegador.</li>
                                <li>Usa la extensión para exportar las cookies de `gemini.google.com` en formato <strong>JSON</strong> o <strong>Netscape</strong>.</li>
                                <li>Pega el contenido completo del archivo exportado en el cuadro de texto de arriba.</li>
                                <li>Haz clic en "Conectar".</li>
                            </ol>
                             <div className="font-bold text-gray-300">Método Alternativo (Manual):</div>
                             <p>Puedes copiar manualmente los valores de las cookies <code>__Secure-1PSID</code> y <code>__Secure-1PSIDTS</code> de las herramientas de desarrollador del navegador y pegarlas en el formato <code>__Secure-1PSID=valor1; __Secure-1PSIDTS=valor2</code>.</p>
                        </div>
                    </details>
                </div>
            )}
            
            {errorMessage && (
                 <div className={`mt-3 text-xs text-red-300 ${statusDisplay.bg} rounded p-2`}>
                    <strong>Error:</strong> {errorMessage}
                </div>
            )}

            {status === 'error' && errorDetails.needsCaptcha && (
                <div className="mt-3 text-xs text-orange-300 bg-orange-900/20 rounded p-3">
                    <strong>🔧 CÓMO RESOLVER CAPTCHA:</strong><br/>
                    1. Abre <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a> en una nueva pestaña.<br/>
                    2. Resuelve cualquier CAPTCHA que aparezca.<br/>
                    3. Asegúrate de que la página cargue completamente.<br/>
                    4. Vuelve aquí y haz clic en "Conectar" nuevamente.<br/>
                    <br/>
                    💡 Si el CAPTCHA sigue apareciendo, espera 10-15 minutos antes de intentar otra vez.
                </div>
            )}

            {status === 'error' && errorDetails.needsReauth && (
                <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 rounded p-3">
                    <strong>🔑 SESIÓN EXPIRADA:</strong><br/>
                    1. Ve a <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a>.<br/>
                    2. Logúeate con tu cuenta Google.<br/>
                    3. Verifica que puedas usar Gemini normalmente.<br/>
                    4. Vuelve aquí y conéctate otra vez.
                </div>
            )}

            {status === 'ready' && (
                <div className={`mt-3 text-xs text-green-300 ${statusDisplay.bg} rounded p-2`}>
                    ✨ <strong>¡Sistema activo!</strong> Generación ilimitada de imágenes habilitada. 
                    Las imágenes ahora se generarán vía Gemini Web sin consumir quota de API.
                </div>
            )}
        </div>
    );
};

export default GeminiWebLogin;