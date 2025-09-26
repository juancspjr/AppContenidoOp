/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import type { PremiumDocumentation } from './types';
import Spinner from '../Spinner';

interface Phase6_1_PremiumDocumentationProps {
    premiumDocumentation: PremiumDocumentation | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void;
    onComplete: () => void;
    onBack: () => void;
}

const Phase6_1_PremiumDocumentation: React.FC<Phase6_1_PremiumDocumentationProps> = ({
    premiumDocumentation, isGenerating, error, onGenerate, onComplete, onBack
}) => {
    const [currentStep, setCurrentStep] = useState('Preparando documentación...');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs(prev => [message, ...prev].slice(0, 10)); // Últimos 10 logs
    };

    const generateWithProgress = async () => {
        setProgress(0);
        setCurrentStep('🚀 Iniciando generación de documentación...');
        addLog('Iniciando proceso de documentación premium');
        
        try {
            setProgress(25);
            setCurrentStep('📋 Preparando datos del proyecto...');
            addLog('Limpiando y validando datos del story plan');
            
            const progressInterval = setInterval(() => {
                 setProgress(p => Math.min(p + 5, 60));
            }, 1000);

            setCurrentStep('🤖 Llamando a la IA para generar documentos...');
            addLog('Enviando solicitud a Gemini API');
            
            await onGenerate();
            
            clearInterval(progressInterval);
            setProgress(75);
            setCurrentStep('📝 Procesando respuesta de la IA...');
            addLog('Validando y formateando documentos generados');
            
            await new Promise(res => setTimeout(res, 500));

            setProgress(100);
            setCurrentStep('✅ Documentación completada exitosamente');
            addLog('Proceso completado - documentos listos');
            
        } catch (err) {
            setCurrentStep('❌ Error en generación de documentación');
            if (err instanceof Error) {
                 addLog(`Error: ${err.message}`);
            } else {
                 addLog('Error desconocido durante la generación.');
            }
        }
    };

    useEffect(() => {
        if (!premiumDocumentation && !isGenerating && !error) {
            generateWithProgress();
        }
    }, [premiumDocumentation, isGenerating, error]);
    
    useEffect(() => {
        if(error) {
            setCurrentStep('❌ Error en generación de documentación');
            addLog(`Error: ${error}`);
        }
    }, [error]);

    if (isGenerating || !premiumDocumentation) {
        return (
            <div className="animate-fade-in space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-blue-400">
                        Fase 6.1: Generando Documentación Premium
                    </h2>
                    <p className="text-gray-400">
                        El equipo de producción de IA está redactando el dossier final de la obra.
                    </p>
                </div>

                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-6 rounded-lg border border-blue-500/30">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-blue-300">
                            🎬 Proceso de Documentación
                        </h3>
                        <div className="text-sm text-gray-400">
                            {progress}% completado
                        </div>
                    </div>
                    
                    <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <div className="text-center mb-4">
                        <div className="text-lg text-white mb-2">{currentStep}</div>
                        {isGenerating && <Spinner className="w-6 h-6 mx-auto mt-2 text-blue-400"/>}
                    </div>
                </div>

                <div className="bg-black/30 p-4 rounded-lg border border-gray-600 max-h-48 overflow-y-auto">
                    <h3 className="font-semibold text-gray-300 mb-3">📋 Proceso en Tiempo Real</h3>
                    <div className="space-y-1 font-mono text-xs">
                        {logs.map((log, index) => (
                            <div key={index} className="p-1.5 rounded text-gray-300">
                                <span className="opacity-60">[{new Date().toLocaleTimeString()}]</span>
                                <span className={`ml-2 ${log.toLowerCase().includes('error') ? 'text-red-400' : ''}`}>{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-center pt-4">
                    <button
                        onClick={onBack}
                        className="bg-gray-600 text-white py-2 px-6 rounded-lg hover:bg-gray-500"
                    >
                        ← Volver al Plan
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-green-900/30 p-6 rounded-lg border border-green-500/30">
                <h3 className="text-xl font-bold text-green-400 mb-4">
                    ✅ Documentación Premium Completada
                </h3>
                <p className="text-gray-300 mb-4">
                    La documentación profesional ha sido generada exitosamente.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/20 p-4 rounded">
                        <h4 className="font-medium text-white">📖 README Master</h4>
                        <p className="text-sm text-gray-300">Resumen ejecutivo del proyecto</p>
                    </div>
                    <div className="bg-black/20 p-4 rounded">
                        <h4 className="font-medium text-white">🎯 Guía de Producción de IA</h4>
                        <p className="text-sm text-gray-300">Prompts para generación de assets</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700">
                <button
                    onClick={onBack}
                    className="w-full sm:w-auto bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-500"
                >
                    ← Volver
                </button>
                <button
                    onClick={onComplete}
                    className="w-full flex-grow bg-green-600 text-white py-3 rounded-lg hover:bg-green-500"
                >
                    Continuar a Evaluación Final →
                </button>
            </div>
        </div>
    );
};

export default Phase6_1_PremiumDocumentation;
