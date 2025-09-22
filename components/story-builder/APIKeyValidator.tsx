/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { runApiKeyValidationTest, forceNextApiQuotaError } from '../../services/geminiService';
import { formatApiError } from '../../utils/errorUtils';
import Spinner from '../Spinner';

const APIKeyValidator: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [testLog, setTestLog] = useState<string[]>([]);

    const addToLog = (message: string) => {
        setTestLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const handleRunTest = async () => {
        setIsLoading(true);
        setTestLog([]);
        addToLog('Iniciando prueba de validación simple...');
        try {
            const { responseText, keyUsedName } = await runApiKeyValidationTest();
            if (responseText === 'OK') {
                addToLog(`✅ ÉXITO: La API [${keyUsedName}] respondió correctamente.`);
            } else {
                addToLog(`⚠️ ADVERTENCIA: La API [${keyUsedName}] respondió con un texto inesperado: "${responseText}"`);
            }
        } catch (error) {
            addToLog(`❌ ERROR: ${formatApiError(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSimulateFailureAndTest = async () => {
        setIsLoading(true);
        setTestLog([]);
        addToLog('Iniciando prueba de rotación con fallo simulado...');

        const failedKeyName = forceNextApiQuotaError();
        if (failedKeyName) {
            addToLog(`➡️ Fallo de cuota forzado en la API [${failedKeyName}].`);
            addToLog('Ejecutando llamada de prueba. Se espera rotación...');
        } else {
            addToLog('⚠️ No hay claves de API activas para simular un fallo. Resetea el pool de APIs.');
            setIsLoading(false);
            return;
        }
        
        try {
            const { responseText, keyUsedName } = await runApiKeyValidationTest();
             if (responseText === 'OK') {
                addToLog(`✅ ÉXITO: El sistema rotó correctamente a la API [${keyUsedName}] y respondió.`);
            } else {
                addToLog(`⚠️ ADVERTENCIA: La API [${keyUsedName}] respondió con un texto inesperado: "${responseText}"`);
            }
        } catch (error) {
            addToLog(`❌ ERROR: ${formatApiError(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">🔬 Validador de Rotación de API</h3>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <button
                    onClick={handleRunTest}
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded transition-colors disabled:bg-blue-800 disabled:cursor-wait"
                >
                    {isLoading ? 'Probando...' : '1. Ejecutar Prueba Simple'}
                </button>
                <button
                    onClick={handleSimulateFailureAndTest}
                    disabled={isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded transition-colors disabled:bg-red-800 disabled:cursor-wait"
                >
                    {isLoading ? 'Probando...' : '2. Simular Fallo y Probar Rotación'}
                </button>
            </div>
            {testLog.length > 0 && (
                <div className="bg-black/30 p-3 rounded-lg max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                        {testLog.join('\n')}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default APIKeyValidator;
