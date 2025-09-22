import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

declare const chrome: any;

interface ExtensionConnectorProps {
  onConnectionSuccess: (cookies: string) => void;
  onClose: () => void;
}

type DiagnosticStatus = 'pending' | 'success' | 'error';
interface DiagnosticStep {
    name: string;
    status: DiagnosticStatus;
    message: string;
}

const EXTENSION_ID_KEY = 'story_builder_extension_id';

export const ExtensionConnector: React.FC<ExtensionConnectorProps> = ({
  onConnectionSuccess,
  onClose,
}) => {
  const [extensionId, setExtensionId] = useState('');
  const [savedExtensionId, setSavedExtensionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticStep[]>([]);
  
  useEffect(() => {
    logger.log('INFO', 'ExtensionConnector', 'Conector de Extensión iniciado.');
    const savedId = localStorage.getItem(EXTENSION_ID_KEY);
    if (savedId) {
      setExtensionId(savedId);
      setSavedExtensionId(savedId);
    }
  }, []);

  const handleSaveId = () => {
    if (extensionId.trim().length > 0) {
      localStorage.setItem(EXTENSION_ID_KEY, extensionId.trim());
      setSavedExtensionId(extensionId.trim());
      logger.log('SUCCESS', 'ExtensionConnector', 'ID de extensión guardado en localStorage.');
      alert('ID de la Extensión guardado exitosamente.');
    } else {
        alert('Por favor, introduce un ID válido.');
    }
  };
  
  const runDiagnostics = useCallback(async () => {
    logger.log('INFO', 'ExtensionConnector', 'Iniciando diagnóstico de conexión...');
    setIsConnecting(true);
    setIsConnected(false);
    setDiagnosticResults([]);

    const updateStep = (step: DiagnosticStep) => {
        setDiagnosticResults(prev => [...prev, step]);
    };

    // Step 1: Check Browser API
    await new Promise(res => setTimeout(res, 100));
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        updateStep({ name: 'API del Navegador', status: 'error', message: 'API de Chrome no disponible. Asegúrate de estar usando un navegador compatible (Chrome, Edge).' });
        setIsConnecting(false);
        return;
    }
    updateStep({ name: 'API del Navegador', status: 'success', message: 'API de Chrome detectada correctamente.' });

    // Step 2: Check for Extension ID
    await new Promise(res => setTimeout(res, 100));
    const currentId = localStorage.getItem(EXTENSION_ID_KEY);
    if (!currentId) {
        updateStep({ name: 'ID de la Extensión', status: 'error', message: 'No se ha guardado ningún ID. Por favor, introduce el ID de tu extensión y guárdalo.' });
        setIsConnecting(false);
        return;
    }
    updateStep({ name: 'ID de la Extensión', status: 'success', message: `Usando ID guardado: ${currentId.substring(0,10)}...` });
    
    // Step 3: Communicate with Extension
    let response: any;
    try {
        await new Promise(res => setTimeout(res, 100));
        response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(currentId, { action: 'getCookiesFromStorage' }, (response: any) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || "Error de comunicación."));
              } else {
                resolve(response);
              }
            });
        });
        updateStep({ name: 'Comunicación', status: 'success', message: 'La extensión ha respondido.' });
    } catch (e: any) {
        updateStep({ name: 'Comunicación', status: 'error', message: `No se pudo comunicar con la extensión. ¿Está instalada, activa y el ID es correcto?` });
        setIsConnecting(false);
        return;
    }

    // Step 4: Validate Response
    await new Promise(res => setTimeout(res, 100));
    if (!response) {
        updateStep({ name: 'Respuesta', status: 'error', message: 'La extensión respondió, pero la respuesta está vacía o es inválida.' });
        setIsConnecting(false);
        return;
    }
     updateStep({ name: 'Respuesta', status: 'success', message: 'La respuesta de la extensión es válida.' });

    // Step 5: Check for Cookies
    await new Promise(res => setTimeout(res, 100));
    if (!response.success || !response.data || response.data.totalCookies === 0) {
        updateStep({ name: 'Cookies', status: 'error', message: response.error || 'No se encontraron cookies. Abre el popup de la extensión y haz clic en "Extraer Cookies".' });
        setIsConnecting(false);
        return;
    }
    updateStep({ name: 'Cookies', status: 'success', message: `Se encontraron ${response.data.totalCookies} cookies.` });
    
    // Step 6: Final Connection
    try {
        await new Promise(res => setTimeout(res, 100));
        await onConnectionSuccess(response.data.cookieString);
        setIsConnected(true);
        updateStep({ name: 'Conexión Final', status: 'success', message: 'Conexión con el servicio de Gemini Web establecida.' });
    } catch (e: any) {
        updateStep({ name: 'Conexión Final', status: 'error', message: `Fallo al inicializar el servicio con las cookies: ${e.message}` });
    } finally {
        setIsConnecting(false);
    }
  }, [onConnectionSuccess]);
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 relative max-w-2xl w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">🚀 Diagnóstico y Conexión de Extensión</h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-2xl"
          aria-label="Cerrar panel de conexión"
        >×</button>
      </div>

      <div className="space-y-4">
        {/* ID Management */}
        <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
            <label htmlFor="extension-id-input" className="block text-sm font-medium text-gray-200">
                ID de la Extensión
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    id="extension-id-input"
                    value={extensionId}
                    onChange={(e) => setExtensionId(e.target.value)}
                    placeholder="Introduce el ID de 32 caracteres de tu extensión"
                    className={`flex-grow bg-gray-900 border rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:outline-none ${savedExtensionId ? 'border-green-500 focus:ring-green-400' : 'border-gray-600 focus:ring-blue-500'}`}
                />
                <button
                    onClick={handleSaveId}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded text-sm transition-transform transform active:scale-95"
                >
                    Guardar ID
                </button>
            </div>
        </div>
        
        {/* Action Button */}
        <button 
          onClick={runDiagnostics}
          disabled={isConnecting || isConnected}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-transform transform active:scale-95 text-base ${
            isConnected ? 'bg-green-600 text-white cursor-default' : 
            isConnecting ? 'bg-gray-600 text-gray-400 cursor-wait' : 
            'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >{isConnected ? '✅ Conectado Exitosamente' : isConnecting ? 'Ejecutando Diagnóstico...' : '🔎 Ejecutar Diagnóstico y Conectar'}</button>
        
        {/* Diagnostics Panel */}
        {diagnosticResults.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-2">
                 <h4 className="font-semibold text-gray-200 mb-2">Resultados del Diagnóstico:</h4>
                {diagnosticResults.map(step => (
                    <div key={step.name} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5">
                            {step.status === 'success' ? '✅' : step.status === 'error' ? '❌' : '⏳'}
                        </span>
                        <div className="flex-grow">
                            <span className={`font-bold ${step.status === 'success' ? 'text-green-400' : step.status === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
                                {step.name}:
                            </span>
                            <span className="ml-2 text-gray-300">{step.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
        
        {/* Instructions */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4 text-sm">
          <strong className="text-blue-300">Instrucciones:</strong>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-blue-200">
            <li>Instala tu extensión en modo desarrollador en Chrome.</li>
            <li>Copia el ID de 32 caracteres de la extensión desde `chrome://extensions`.</li>
            <li>Pega el ID arriba y haz clic en "Guardar ID".</li>
            <li>Abre <code className="bg-gray-900/50 px-1 rounded">gemini.google.com</code> y haz login.</li>
            <li>Abre el popup de la extensión y haz clic en "Extraer Cookies".</li>
            <li>Vuelve aquí y haz clic en "Ejecutar Diagnóstico y Conectar".</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
