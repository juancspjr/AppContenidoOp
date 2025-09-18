/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { geminiWebService } from '@/services/geminiWebService';

const MANUAL_COOKIES_KEY = 'gemini_web_manual_cookies';

const GeminiWebLogin: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'checking' | 'login_required' | 'connecting' | 'ready' | 'error'>('checking');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [cookieFields, setCookieFields] = useState({
        '__Secure-1PSID': '',
        '__Secure-1PSIDTS': '',
        'HSID': '',
        'SSID': '',
        'APISID': '',
        'SAPISID': '',
    });
    const [errorDetails, setErrorDetails] = useState<{
        needsCaptcha?: boolean;
        needsReauth?: boolean;
        message?: string;
    }>({});
    
    const essentialCookiesProvided = cookieFields['__Secure-1PSID'].trim() !== '' && cookieFields['__Secure-1PSIDTS'].trim() !== '';

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
                    // If no validated session, try loading manually saved fields
                    const savedFields = localStorage.getItem(MANUAL_COOKIES_KEY);
                    if (savedFields) {
                        try {
                            const parsedFields = JSON.parse(savedFields);
                            setCookieFields(parsedFields);
                            console.log('🍪 Campos de cookies cargados desde localStorage.');
                        } catch (e) {
                            console.error("No se pudieron analizar los campos de cookies guardados.");
                            localStorage.removeItem(MANUAL_COOKIES_KEY);
                        }
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

    const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCookieFields(prev => ({ ...prev, [name]: value }));
    };

    const handleConnectWithCookieString = async (cookieString: string, isFromManualFields: boolean = false) => {
        if (!cookieString.trim()) {
            setErrorMessage("No se proporcionaron cookies.");
            setStatus('login_required');
            return;
        }

        setIsLoading(true);
        setStatus('connecting');
        setErrorMessage('');
        setErrorDetails({});
        
        try {
            console.log('🔐 Iniciando conexión con Gemini Web usando las cookies proporcionadas...');
            
            const success = await geminiWebService.initialize(cookieString);
            
            if (success) {
                setIsInitialized(true);
                setStatus('ready');

                // Save manually entered fields on success
                if (isFromManualFields) {
                    try {
                        localStorage.setItem(MANUAL_COOKIES_KEY, JSON.stringify(cookieFields));
                        console.log('🍪 Cookies manuales guardadas en localStorage tras conexión exitosa.');
                    } catch (e) {
                        console.error("No se pudieron guardar las cookies en localStorage.", e);
                    }
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
        const cookieString = Object.entries(cookieFields)
            .filter(([_, value]) => value.trim() !== '')
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
            
        handleConnectWithCookieString(cookieString, true);
    };

    const handlePasteJsonCookies = () => {
        const jsonInput = prompt(`📋 PEGA TUS COOKIES EN FORMATO JSON AQUÍ:
    
(Si obtuviste cookies de una extensión de navegador, pégalas tal como vienen)`);
        
        if (!jsonInput) return;
        
        try {
            const cookies = JSON.parse(jsonInput);
            
            if (Array.isArray(cookies) && cookies.length > 0 && 'name' in cookies[0] && 'value' in cookies[0]) {
                const cookieString = cookies
                    .map(cookie => `${cookie.name}=${cookie.value}`)
                    .join('; ');
                
                console.log('🔄 Cookies JSON convertidas a string');
                handleConnectWithCookieString(cookieString, false);
            } else {
                console.log('📝 Tratando como string de cookies normal (JSON no era un array de cookies válido)');
                handleConnectWithCookieString(jsonInput, false);
            }
        } catch (error) {
            console.log('📝 Tratando como string de cookies normal (no es JSON)');
            handleConnectWithCookieString(jsonInput, false);
        }
    };
    
    const handleDisconnect = () => {
        localStorage.removeItem('gemini_web_cookies');
        localStorage.removeItem(MANUAL_COOKIES_KEY); // Clear saved fields on disconnect
        setIsInitialized(false);
        setStatus('login_required');
        setCookieFields({ '__Secure-1PSID': '', '__Secure-1PSIDTS': '', 'HSID': '', 'SSID': '', 'APISID': '', 'SAPISID': '' }); // Clear fields in UI
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
                        <>
                            <button
                                onClick={handleConnect}
                                disabled={isLoading || status === 'checking' || !essentialCookiesProvided}
                                className={`px-6 py-2 rounded-lg font-bold transition-all ${
                                    (isLoading || status === 'checking' || !essentialCookiesProvided)
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
                            <button
                                onClick={handlePasteJsonCookies}
                                disabled={isLoading || status === 'checking'}
                                className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-500 text-white font-bold transition-all disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                📋 Pegar Cookies JSON
                            </button>
                        </>
                    )}
                </div>
            </div>

             {!isInitialized && status !== 'checking' && (
                <div className="mt-4 border-t border-purple-700/50 pt-4 space-y-2 animate-fade-in">
                    <p className="block text-sm font-bold text-gray-200">Pega los valores de tus cookies de Gemini:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        {Object.keys(cookieFields).map(key => (
                            <div key={key}>
                                <label htmlFor={key} className="block text-xs font-mono text-gray-400">{key} <span className={key.includes('PSID') ? 'text-red-400' : 'text-gray-500'}>*</span></label>
                                <input
                                    type="text"
                                    id={key}
                                    name={key}
                                    value={cookieFields[key as keyof typeof cookieFields]}
                                    onChange={handleFieldChange}
                                    placeholder="Pega el valor aquí..."
                                    className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-1.5 font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                    disabled={isLoading}
                                />
                            </div>
                        ))}
                    </div>

                    <details className="text-xs text-gray-400 pt-2">
                        <summary className="cursor-pointer hover:text-white">¿Cómo obtener las cookies?</summary>
                        <div className="mt-2 p-3 bg-black/20 rounded-md space-y-3">
                            <div className="font-bold text-yellow-300">Método Recomendado (Más fácil):</div>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Abre <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">gemini.google.com</a> e inicia sesión.</li>
                                <li>Abre las Herramientas de Desarrollador (F12 o Cmd+Opt+I).</li>
                                <li>Ve a la pestaña <strong>"Application"</strong> (o "Aplicación").</li>
                                <li>En el menú de la izquierda, busca "Storage" -> "Cookies" y haz clic en <code>https://gemini.google.com</code>.</li>
                                <li>Verás una tabla con todas las cookies. Busca por <strong>"Name"</strong> (ej. <code>__Secure-1PSID</code>) y copia el <strong>"Value"</strong> (Valor) correspondiente en el campo de arriba.</li>
                                <li>Repite para todos los campos requeridos (marcados con <span className="text-red-400">*</span>).</li>
                            </ol>
                             <div className="font-bold text-green-300">Método Alternativo (con extensión):</div>
                             <p>Instala una extensión de navegador como "Get cookies.txt" o "EditThisCookie". Exporta las cookies de <code>gemini.google.com</code> en formato JSON y usa el botón "Pegar Cookies JSON".</p>
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