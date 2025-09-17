/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// 🎮 COMPONENTE SIMPLE DE LOGIN
// ============================================================================

import React, { useState, useEffect } from 'react';
import { geminiWebService } from '@/services/geminiWebService';

const GeminiWebLogin: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'login_required' | 'extracting' | 'ready' | 'error'>('idle');
    
    useEffect(() => {
        // VERIFICAR SI YA ESTÁ INICIALIZADO
        const checkStatus = () => {
            const initialized = geminiWebService.isInitialized();
            setIsInitialized(initialized);
            setStatus(initialized ? 'ready' : 'login_required');
        };
        
        checkStatus();
    }, []);
    
    // FUNCIÓN PARA EXTRAER COOKIES DESDE LA CONSOLA
    const extractCookiesFromCurrentTab = (): string | null => {
        try {
            if (typeof document === 'undefined') return null;
            
            const cookies = document.cookie;
            
            if (cookies.includes('__Secure-1PSID') && cookies.includes('__Secure-1PSIDTS')) {
                return cookies;
            }
            
            return null;
        } catch (error) {
            console.error('Error extrayendo cookies:', error);
            return null;
        }
    };
    
    // MANEJAR CLICK DEL BOTÓN DE LOGIN
    const handleLogin = async () => {
        setIsLoading(true);
        setStatus('extracting');
        
        try {
            // 1. INTENTAR EXTRAER COOKIES DE LA TAB ACTUAL
            const cookies = extractCookiesFromCurrentTab();
            
            if (cookies) {
                console.log('🍪 Cookies encontradas en tab actual');
                
                const success = await geminiWebService.initialize(cookies);
                
                if (success) {
                    setIsInitialized(true);
                    setStatus('ready');
                    alert('✅ Gemini Web conectado exitosamente!');
                } else {
                    throw new Error('Cookies inválidas o expiradas');
                }
            } else {
                // 2. REDIRIGIR A GEMINI PARA OBTENER COOKIES
                console.log('🌐 Redirigiendo a Gemini para login...');
                
                alert(`🔐 PASO 1: 
                
1. Se abrirá Gemini en una nueva pestaña.
2. Asegúrate de estar logueado en tu cuenta de Google.
3. Vuelve a esta pestaña y haz clic en "Conectar" nuevamente.

¿Continuar?`);
                
                // ABRIR GEMINI EN NUEVA PESTAÑA
                window.open('https://gemini.google.com', '_blank');
                
                setStatus('login_required');
            }
        } catch (error: any) {
            console.error('❌ Error en login:', error);
            setStatus('error');
            alert(`❌ Error: ${error.message || 'No se pudo conectar con Gemini Web'}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const getStatusInfo = () => {
        switch (status) {
            case 'idle':
                return { icon: '⚪', text: 'Iniciando...', color: 'text-gray-400' };
            case 'login_required':
                return { icon: '🔐', text: 'Login requerido', color: 'text-yellow-400' };
            case 'extracting':
                return { icon: '🔄', text: 'Conectando...', color: 'text-blue-400' };
            case 'ready':
                return { icon: '✅', text: 'Gemini Web conectado', color: 'text-green-400' };
            case 'error':
                return { icon: '❌', text: 'Error de conexión', color: 'text-red-400' };
            default:
                return { icon: '❓', text: 'Estado desconocido', color: 'text-gray-400' };
        }
    };
    
    const statusInfo = getStatusInfo();
    
    return (
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{statusInfo.icon}</span>
                    <div>
                        <h3 className="font-bold text-white">🌐 Gemini Web Unlimited</h3>
                        <p className={`text-sm ${statusInfo.color}`}>{statusInfo.text}</p>
                    </div>
                </div>
                
                {!isInitialized && (
                    <button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${
                            isLoading 
                                ? 'bg-gray-600 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg'
                        }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                Conectando...
                            </div>
                        ) : (
                            '🔗 Conectar Gemini Web'
                        )}
                    </button>
                )}
            </div>
            
            {status === 'ready' && (
                <div className="mt-3 text-xs text-green-300 bg-green-900/20 rounded p-2">
                    ✨ Generación ilimitada de imágenes activa. Sin restricciones de cuota.
                </div>
            )}
            
            {status === 'login_required' && (
                <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 rounded p-2">
                    💡 <strong>Instrucciones:</strong><br/>
                    1. Haz clic en "Conectar Gemini Web"<br/>
                    2. Se abrirá gemini.google.com en nueva pestaña<br/>
                    3. Asegúrate de estar logueado<br/>
                    4. Vuelve aquí y haz clic en "Conectar" otra vez
                </div>
            )}
        </div>
    );
};

export default GeminiWebLogin;