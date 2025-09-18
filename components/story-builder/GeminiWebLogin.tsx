/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { geminiWebService } from '@/services/geminiWebService';

interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: any;
}

interface ExtensionState {
    isInstalled: boolean;
    isReady: boolean;
    isConnecting: boolean;
    isConnected: boolean;
    cookiesData: {
        cookieString: string;
        totalCookies: number;
        hasCriticalCookies: boolean;
        status: 'ready' | 'incomplete' | 'error';
        timestamp: number;
    } | null;
    logs: LogEntry[];
    error: string | null;
}

const GeminiWebLogin: React.FC = () => {
    const [state, setState] = useState<ExtensionState>({
        isInstalled: false,
        isReady: false,
        isConnecting: false,
        isConnected: false,
        cookiesData: null,
        logs: [],
        error: null,
    });
    const logContainerRef = useRef<HTMLDivElement>(null);
    // FIX: Replaced Node.js-specific `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`
    // to ensure type compatibility in a browser environment.
    const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addLog = useCallback((level: LogEntry['level'], message: string, details?: any) => {
        setState(prevState => {
            const newLog: LogEntry = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                level,
                message,
                details,
            };
            const updatedLogs = [...prevState.logs, newLog];
            if (updatedLogs.length > 100) {
                updatedLogs.shift();
            }
            return { ...prevState, logs: updatedLogs };
        });
    }, []);

    const handleConnectionError = useCallback((errorMessage: string, details?: any) => {
        setState(prev => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
            error: errorMessage,
        }));
        addLog('error', `Error en la conexión: ${errorMessage}`, details);
        geminiWebService.initialize('').catch(() => {}); // Reset service
    }, [addLog]);

    const handleCookiesReceived = useCallback(async (data: ExtensionState['cookiesData']) => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        setState(prev => ({ ...prev, cookiesData: data, isConnecting: true }));
        addLog('success', `Cookies recibidas: ${data?.totalCookies} total.`, { critical: data?.hasCriticalCookies, status: data?.status });

        if (data?.status !== 'ready' || !data.cookieString) {
            handleConnectionError('Las cookies recibidas son incompletas o inválidas.');
            return;
        }

        try {
            addLog('info', 'Inicializando geminiWebService con cookies...');
            await geminiWebService.initialize(data.cookieString);
            setState(prev => ({ ...prev, isConnecting: false, isConnected: true, error: null }));
            addLog('success', '¡Conexión exitosa con Gemini Web!');
            alert('🎉 ¡Conectado con Gemini Web exitosamente!');
        } catch (error: any) {
            handleConnectionError(error.message, error);
        }
    }, [addLog, handleConnectionError]);

    useEffect(() => {
        addLog('info', 'Componente GeminiWebLogin iniciado.');

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin && event.source !== window) return;

            if (event.data.type === 'STORY_BUILDER_EXTENSION_READY') {
                setState(prev => ({ ...prev, isInstalled: true, isReady: true }));
                addLog('success', 'Extensión detectada y lista para conectar.');
            }

            if (event.data.type === 'STORY_BUILDER_COOKIES_RESPONSE') {
                if (event.data.success) {
                    handleCookiesReceived(event.data.data);
                } else {
                    handleConnectionError(event.data.error || 'La extensión reportó un error desconocido.');
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Check if extension is already there
        setTimeout(() => {
            if (!state.isInstalled) {
                addLog('warning', 'Extensión no detectada. Asegúrate de que está instalada y activa.');
            }
        }, 2000);


        return () => window.removeEventListener('message', handleMessage);
    }, [addLog, handleCookiesReceived, handleConnectionError, state.isInstalled]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [state.logs]);

    const connectWithExtension = () => {
        if (!state.isReady) {
            addLog('error', 'Intento de conexión sin que la extensión esté lista.');
            return;
        }
        setState(prev => ({ ...prev, isConnecting: true, error: null }));
        addLog('info', 'Solicitando cookies de la extensión...');

        try {
            window.postMessage({ type: 'STORY_BUILDER_REQUEST_COOKIES' }, '*');

            connectionTimeoutRef.current = setTimeout(() => {
                setState(prev => {
                    if (prev.isConnecting && !prev.isConnected) {
                        addLog('error', 'Timeout: No se recibió respuesta de la extensión en 10 segundos.');
                        return { ...prev, isConnecting: false, error: 'La extensión no respondió a tiempo.' };
                    }
                    return prev;
                });
            }, 10000);
        } catch (error) {
            handleConnectionError('Error al enviar el mensaje a la extensión.', error);
        }
    };

    const validateConnection = async () => {
        const status = geminiWebService.getStatus();
        addLog('info', 'Validando estado de conexión...', status);
        setState(prev => ({...prev, isConnected: status.initialized}));
    };
    
    const clearLogs = () => setState(prev => ({ ...prev, logs: [] }));

    const getStatusInfo = () => {
        if (!state.isInstalled) return { icon: '🔴', text: 'Extensión no detectada', color: 'text-red-400' };
        if (state.isConnected) return { icon: '🟢', text: 'Conectado exitosamente', color: 'text-green-400' };
        if (state.isReady) return { icon: '🟡', text: 'Extensión lista para conectar', color: 'text-yellow-400' };
        return { icon: '❓', text: 'Estado desconocido', color: 'text-gray-400' };
    };

    const statusInfo = getStatusInfo();

    const LogLine: React.FC<{ log: LogEntry }> = ({ log }) => {
        const levelColors = {
            info: 'text-blue-400',
            success: 'text-green-400',
            warning: 'text-yellow-400',
            error: 'text-red-400',
        };
        return (
            <div className="font-mono text-xs mb-1 last:mb-0">
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`font-bold mx-2 ${levelColors[log.level]}`}>{log.level.toUpperCase()}</span>
                <span className="text-gray-300">{log.message}</span>
                {log.details && (
                     <details className="mt-1 ml-4 text-gray-400">
                        <summary className="cursor-pointer text-xs">Detalles</summary>
                        <pre className="text-xs bg-black/50 p-1 rounded whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        );
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel: Connection Control */}
                <div className="flex flex-col gap-4">
                    <button
                        onClick={connectWithExtension}
                        disabled={!state.isReady || state.isConnecting || state.isConnected}
                        className="w-full bg-gradient-to-r from-green-600 to-teal-500 text-white font-bold py-4 rounded-lg hover:from-green-500 hover:to-teal-400 transition-all shadow-lg disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed"
                    >
                        {state.isConnecting ? 'Conectando...' : state.isConnected ? 'Conectado' : '🔐 Conectar con Extensión'}
                    </button>
                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex-grow flex flex-col justify-between">
                       <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-2xl">{statusInfo.icon}</span>
                                <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.text}</p>
                            </div>
                            <div className="text-sm space-y-2 text-gray-300">
                                <p><strong>Estado:</strong> {state.isConnected ? "Conectado" : "No conectado"}</p>
                                <p><strong>Cookies detectadas:</strong> {state.cookiesData?.totalCookies ?? 'N/A'}</p>
                                <p><strong>Última conexión:</strong> {state.cookiesData?.timestamp ? new Date(state.cookiesData.timestamp).toLocaleString() : 'N/A'}</p>
                            </div>
                       </div>
                        <button onClick={validateConnection} className="w-full mt-4 bg-white/10 text-white text-sm py-2 rounded-lg hover:bg-white/20">
                            🔄 Refrescar Estado
                        </button>
                    </div>
                </div>

                {/* Right Panel: Logs */}
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-gray-200">📝 Logs del Sistema</h4>
                        <button onClick={clearLogs} className="text-xs bg-red-800/50 text-red-300 px-2 py-1 rounded hover:bg-red-700/50">
                            🗑️ Limpiar
                        </button>
                    </div>
                    <div ref={logContainerRef} className="h-[250px] bg-black/50 rounded p-2 overflow-y-auto">
                        {state.logs.map(log => <LogLine key={log.id} log={log} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeminiWebLogin;