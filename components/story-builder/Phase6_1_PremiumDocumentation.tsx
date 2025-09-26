/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import type { PremiumDocumentation, LogEntry } from './types';
import Spinner from '../Spinner';

interface DocStatus {
    id: string;
    name: string;
    status: 'pending' | 'generating' | 'complete' | 'error' | 'on_demand';
    required: boolean;
    error?: string;
}

interface Phase6_1_PremiumDocumentationProps {
    premiumDocumentation: PremiumDocumentation | null;
    isGenerating: boolean;
    error: string | null;
    onGenerate: () => void; // Generates essential docs
    onGenerateSpecific: (docId: string) => Promise<any>; // Generates one doc
    onComplete: () => void;
    onBack: () => void;
    logs: LogEntry[];
}

const Phase6_1_PremiumDocumentation: React.FC<Phase6_1_PremiumDocumentationProps> = ({
    premiumDocumentation, isGenerating, error, onGenerate, onGenerateSpecific, onComplete, onBack, logs
}) => {
    const [docQueue, setDocQueue] = useState<DocStatus[]>([
        { id: 'narrativeStory', name: 'Dossier Narrativo', status: 'pending', required: true },
        { id: 'aiProductionGuide', name: 'Guía de Prompts (JSON)', status: 'pending', required: true },
        { id: 'directorsBible', name: 'Biblia del Director', status: 'on_demand', required: false },
        { id: 'visualStyleGuide', name: 'Guía de Estilo Visual', status: 'on_demand', required: false },
        { id: 'literaryScript', name: 'Guion Literario', status: 'on_demand', required: false },
    ]);

    useEffect(() => {
        if (!premiumDocumentation && !isGenerating && !error) {
            onGenerate();
        }
    }, [premiumDocumentation, isGenerating, error, onGenerate]);
    
    useEffect(() => {
        // Update status based on received documentation
        if (premiumDocumentation) {
            setDocQueue(prev => prev.map(doc => {
                if ((premiumDocumentation as any)[doc.id]) {
                    return { ...doc, status: 'complete' };
                }
                return doc;
            }));
        }
    }, [premiumDocumentation]);


    const handleGenerateOnDemand = async (docId: string) => {
        setDocQueue(prev => prev.map(d => d.id === docId ? { ...d, status: 'generating' } : d));
        try {
            await onGenerateSpecific(docId);
            setDocQueue(prev => prev.map(d => d.id === docId ? { ...d, status: 'complete' } : d));
        } catch (e: any) {
            setDocQueue(prev => prev.map(d => d.id === docId ? { ...d, status: 'error', error: e.message } : d));
        }
    };
    
    const allDocsCompleted = docQueue.every(d => d.status === 'complete');
    const essentialDocsCompleted = docQueue.filter(d => d.required).every(d => d.status === 'complete');

    if (isGenerating && !premiumDocumentation) {
        return (
            <div className="animate-fade-in space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-blue-400">Fase 6.1: Generando Documentos Esenciales...</h2>
                    <p className="text-gray-400">El equipo de producción de IA está redactando el dossier crítico para tu obra.</p>
                </div>
                <div className="text-center p-8"><Spinner /></div>
                 <div className="bg-black/30 p-4 rounded-lg border border-gray-600 max-h-64 overflow-y-auto">
                    <h3 className="font-semibold text-gray-300 mb-3">📋 Log de Procesamiento</h3>
                    <div className="space-y-1 text-sm font-mono">
                        {logs?.slice(-10).reverse().map((log, index) => (
                            <div key={index} className="text-gray-300">
                                <span className="text-xs opacity-75 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-green-400">Fase 6.1: Dossier de Producción Premium</h2>
                <p className="text-gray-400">Documentos esenciales generados. Puedes generar documentos adicionales bajo demanda y descargar respaldos completos.</p>
            </div>
            
            {error && <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-300">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {docQueue.map(doc => (
                    <div key={doc.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-white">{doc.name}</h4>
                            <p className="text-xs text-gray-400">{doc.required ? 'Esencial' : 'Bajo Demanda'}</p>
                        </div>
                        {doc.status === 'complete' && <span className="text-green-400 font-bold">✅ Generado</span>}
                        {doc.status === 'generating' && <Spinner className="w-5 h-5"/>}
                        {doc.status === 'error' && <span className="text-red-400 text-xs">{doc.error}</span>}
                        {doc.status === 'on_demand' && (
                            <button onClick={() => handleGenerateOnDemand(doc.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-500">Generar</button>
                        )}
                    </div>
                 ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button onClick={onBack} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500">Atrás</button>
                <button 
                    onClick={onComplete}
                    disabled={!essentialDocsCompleted}
                    className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                    {essentialDocsCompleted ? 'Continuar a Evaluación Final' : 'Esperando documentos esenciales...'}
                </button>
            </div>
        </div>
    );
};

export default Phase6_1_PremiumDocumentation;