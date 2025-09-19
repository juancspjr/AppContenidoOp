import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

declare const chrome: any;

interface ExtensionConnectorProps {
  onConnectionSuccess: (cookies: string) => void;
  onClose: () => void;
}

export const ExtensionConnector: React.FC<ExtensionConnectorProps> = ({
  onConnectionSuccess,
  onClose,
}) => {
  const [extensionReady, setExtensionReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [cookiesData, setCookiesData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkExtensionCookies = useCallback(async () => {
    logger.log('INFO', 'ExtensionConnector', 'Verificando conexión con la extensión...');
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
        logger.log('SUCCESS', 'ExtensionConnector', `Cookies obtenidas: ${data.totalCookies} encontradas`, data);
        setCookiesData(data);
        setExtensionReady(true);
        setError(null);
        
        try {
          await onConnectionSuccess(data.cookieString);
          setIsConnected(true);
          logger.log('SUCCESS', 'ExtensionConnector', 'Conexión con Gemini Web establecida correctamente.');
        } catch (e: any) {
          logger.log('ERROR', 'ExtensionConnector', 'Fallo al inicializar el servicio con las cookies.', e.message);
          setError(e.message);
          setIsConnected(false);
        }
      } else {
        logger.log('WARNING', 'ExtensionConnector', 'La extensión no tiene cookies válidas.', response);
        setExtensionReady(true);
        setError(response?.error || 'No se encontraron cookies. Abre el popup de la extensión y haz clic en "Extraer Cookies" primero.');
        setIsConnected(false);
      }
    } catch (e: any) {
      logger.log('ERROR', 'ExtensionConnector', 'No se pudo conectar con la extensión.', e.message);
      setExtensionReady(false);
      setError('La extensión no responde. Asegúrate de que "Story Builder - Conector Gemini Web" esté instalada, activa y recarga la página.');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [onConnectionSuccess]);

  useEffect(() => {
    logger.log('INFO', 'ExtensionConnector', 'Conector de Extensión iniciado.');
    checkExtensionCookies();
  }, [checkExtensionCookies]);
  
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
    </div>
  );
};

export default ExtensionConnector;