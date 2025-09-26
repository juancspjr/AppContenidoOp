/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { Documentation } from './types';
import { geminiService } from '../../services/geminiService';
import { parseJsonMarkdown } from '../../utils/parserUtils';

interface DocumentationEvaluatorProps {
  documentation: Documentation | null;
  onApprove: () => void;
  onRequestRevisions: (revisions: string[]) => void;
  isProcessing: boolean;
}

const callAIService = async (prompt: string, textModel?: string) => {
    const response = await geminiService.generateContent({
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    }, textModel);
    return parseJsonMarkdown(response.text);
}

export const DocumentationEvaluator: React.FC<DocumentationEvaluatorProps> = ({
  documentation, onApprove, onRequestRevisions, isProcessing
}) => {
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [selectedRevisions, setSelectedRevisions] = useState<string[]>([]);

  const evaluateDocumentation = async () => {
    if (!documentation) return;
    const prompt = `
EVALUACIÓN INTEGRAL DE DOCUMENTACIÓN COMPLETA

DOCUMENTOS A EVALUAR:
- README: ${documentation.readme}
- Narrative Story: ${documentation.narrativeStory}
- Literary Script: ${documentation.literaryScript}
- Director's Bible: ${documentation.directorsBible}
- Visual Style Guide: ${documentation.visualStyleGuide}

CRITERIOS DE EVALUACIÓN:
1. Coherencia entre todos los documentos
2. Calidad artística individual
3. Integración viral natural (no forzada)
4. Consistencia de personajes/estilo entre documentos
5. Viabilidad de producción

IDENTIFICA:
- Inconsistencias entre documentos
- Áreas de mejora holística
- Recomendaciones que afecten múltiples documentos
- Balance entre calidad artística y viralidad

FORMATO:
{
  "overall_score": number,
  "document_scores": {},
  "consistency_issues": [],
  "improvement_recommendations": [],
  "viral_integration_quality": number
}
`;

    const result = await callAIService(prompt);
    setEvaluationResult(result);
  };

  if (!documentation) {
    return <div>Cargando documentación...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-2xl font-bold text-purple-400">
        Fase 6.2.5: Evaluador Maestro de Documentación
      </h3>
      
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-6 rounded-lg">
        <p className="text-gray-300 mb-4">
          El Evaluador Maestro analiza TODA la documentación como un conjunto integral, 
          identificando inconsistencias y optimizaciones que mejoren el conjunto completo.
        </p>
        
        <button
          onClick={evaluateDocumentation}
          disabled={isProcessing || evaluationResult}
          className="bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed"
        >
          🔍 Evaluar Documentación Completa
        </button>
      </div>

      {evaluationResult && (
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-bold text-green-400 mb-2">Evaluación Integral</h4>
            <div className="text-2xl font-bold text-blue-400">
              {evaluationResult.overall_score}% 
              <span className="text-sm text-gray-400"> Score General</span>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="font-bold text-yellow-400 mb-2">Recomendaciones de Mejora</h4>
            {evaluationResult.improvement_recommendations.map((rec: string, i: number) => (
              <label key={i} className="flex items-start gap-3 p-2 hover:bg-gray-700 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRevisions.includes(rec)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRevisions([...selectedRevisions, rec]);
                    } else {
                      setSelectedRevisions(selectedRevisions.filter(r => r !== rec));
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-sm text-gray-300">{rec}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => onRequestRevisions(selectedRevisions)}
              disabled={selectedRevisions.length === 0 || isProcessing}
              className="w-full sm:w-auto bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-yellow-500 disabled:bg-yellow-800 disabled:cursor-not-allowed"
            >
              ⚡ Aplicar {selectedRevisions.length} Mejoras Seleccionadas
            </button>
            
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="w-full sm:w-auto flex-grow bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed"
            >
              ✅ Aprobar Documentación y Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentationEvaluator;