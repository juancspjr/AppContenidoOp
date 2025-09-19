import React, { useState, useEffect, useCallback } from 'react';

declare const chrome: any;

interface ExtensionConnectorProps {
  onConnectionSuccess: (cookies: string) => void;
  onClose: () => void;
}

type Log = {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
};

export const ExtensionConnector: React.FC<ExtensionConnectorProps> = ({
  onConnectionSuccess,
  onClose,
}) => {
  const [extensionReady, setExtensionReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [cookiesData, setCookiesData] = useState<any>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = useCallback((level: Log['level'], message: string, details: any = null) => {
    const newLog: Log = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      message,
      details,
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
    console.log(`${level.toUpperCase()}: ${message}`, details || '');
  }, []);

  const checkExtensionCookies = useCallback(async () => {
    addLog('info', 'Verificando conexión con la extensión...');
    setIsConnecting(true);
    setError(null);
    
    try {
      const extensionId = 'fbjdjkiloljkafehandlafajibeoihmn';
      
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error("La API de Chrome (`chrome.runtime`) no está disponible. Asegúrate de estar usando un navegador compatible (Chrome, Edge, etc.).");
      }

      const response: any = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(extensionId, { action: 'getCookiesFromStorage' }, (response: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message || "Error de comunicación. ¿Está la extensión instalada y activa?"));
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.success) {
        const data = response.data;
        addLog('success', `Cookies obtenidas: ${data.totalCookies} encontradas`, data);
        setCookiesData(data);
        setExtensionReady(true);
        setError(null);
        
        try {
          await onConnectionSuccess(data.cookieString);
          setIsConnected(true);
          addLog('success', 'Conexión con Gemini Web establecida correctamente.');
        } catch (e: any) {
          addLog('error', 'Fallo al inicializar el servicio con las cookies.', e.message);
          setError(e.message);
          setIsConnected(false);
        }
      } else {
        addLog('warning', 'La extensión no tiene cookies válidas.', response);
        setExtensionReady(true);
        setError(response?.error || 'No se encontraron cookies. Abre el popup de la extensión y haz clic en "Extraer Cookies" primero.');
        setIsConnected(false);
      }
    } catch (e: any) {
      addLog('error', 'No se pudo conectar con la extensión.', e.message);
      setExtensionReady(false);
      setError('La extensión no responde. Asegúrate de que "Story Builder - Conector Gemini Web" esté instalada, activa y recarga la página.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [addLog, onConnectionSuccess]);

  useEffect(() => {
    addLog('info', 'Conector de Extensión iniciado.');
    checkExtensionCookies();
  }, [addLog, checkExtensionCookies]);

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Logs limpiados.');
  };

  const logColorClasses: Record<Log['level'], string> = {
    error: 'text-red-400',
    warning: 'text-yellow-400',
    success: 'text-green-400',
    info: 'text-blue-400'
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">🚀 Conexión de Generación Ilimitada</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-2xl"
          aria-label="Cerrar panel de conexión"
        >×</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-blue-500' : extensionReady ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium text-white">
              {isConnected ? '🟢 Conectado' : 
               isConnecting ? '🔵 Conectando...' :
               extensionReady ? '🟡 Extensión lista, no conectada' : '🔴 Extensión no detectada'}
            </span>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Estado:</span><span className="font-medium text-white">{isConnected ? 'Conectado' : 'No conectado'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Cookies:</span><span className="font-medium text-white">{cookiesData?.totalCookies ?? 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Última Extracción:</span><span className="font-medium text-white">{cookiesData?.timestamp ? new Date(cookiesData.timestamp).toLocaleTimeString() : 'N/A'}</span></div>
          </div>

          <button 
            onClick={checkExtensionCookies}
            disabled={isConnecting || isConnected}
            className={`w-full py-3 px-4 rounded-lg font-bold transition-transform transform active:scale-95 ${
              isConnected ? 'bg-green-600 text-white cursor-default' : 
              isConnecting ? 'bg-gray-600 text-gray-400 cursor-wait' : 
              'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >{isConnected ? '✅ Conectado' : isConnecting ? 'Conectando...' : '🔄 Refrescar Conexión'}</button>

          {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">❌ {error}</div>}

          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-sm">
            <strong className="text-blue-300">Instrucciones:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-blue-200">
              <li>Instala la extensión <strong className="text-white">"Story Builder - Conector Gemini Web"</strong>.</li>
              <li>Abre <code className="bg-gray-900/50 px-1 rounded">gemini.google.com</code> y haz login en tu cuenta.</li>
              <li>Abre el popup de la extensión (ícono en la barra de Chrome).</li>
              <li>Haz clic en el botón <strong className="text-white">"🍪 Extraer Cookies"</strong>.</li>
              <li>Vuelve aquí y haz clic en <strong className="text-white">"Refrescar Conexión"</strong>.</li>
            </ol>
          </div>
        </div>

        <div className="space-y-3 flex flex-col">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold text-white">📝 Logs de Conexión</h4>
            <button onClick={clearLogs} className="text-xs bg-red-600/50 text-red-200 px-2 py-1 rounded hover:bg-red-600/80 transition-colors">🗑️ Limpiar</button>
          </div>
          <div className="bg-black/50 rounded-lg p-3 flex-grow overflow-y-auto font-mono text-xs h-96 border border-gray-700/50">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">Esperando logs...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="mb-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`font-bold ${logColorClasses[log.level]}`}>{log.level.toUpperCase()}</span>
                    <span className="text-gray-200 flex-1">{log.message}</span>
                  </div>
                  {log.details && <div className="text-gray-400 text-xs ml-16 mt-1 opacity-60">{JSON.stringify(log.details)}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionConnector;