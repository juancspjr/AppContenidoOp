/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { PremiumStoryPlan } from './types';
import { analyzeMetricsAndSuggestImprovements } from '../../services/metricsOptimizer';
import Spinner from '../Spinner';
import { SparkleIcon } from '../icons';

interface MetricsOptimizationPanelProps {
  currentMetrics: {
    viral_potential: number;
    human_authenticity: number;
  };
  storyPlan: PremiumStoryPlan;
  onOptimize: (improvements: any[]) => void;
  isOptimizing: boolean;
}

interface Recommendation {
    id: string;
    title: string;
    description: string;
    impact_points: number;
    category: 'viral' | 'authenticity';
}

interface Suggestions {
    projected_viral: number;
    projected_authenticity: number;
    improvements: Recommendation[];
}

export const MetricsOptimizationPanel: React.FC<MetricsOptimizationPanelProps> = ({
  currentMetrics, storyPlan, onOptimize, isOptimizing
}) => {
  const [recommendations, setRecommendations] = useState<Suggestions | null>(null);
  const [selectedImprovements, setSelectedImprovements] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // Mostrar el banner de optimización solo si las métricas son bajas
  const shouldShowBanner = currentMetrics.viral_potential < 7 || currentMetrics.human_authenticity < 80;

  if (!shouldShowBanner) return null;

  const generateRecommendations = async () => {
    setIsAnalyzing(true);
    try {
      const recs = await analyzeMetricsAndSuggestImprovements(storyPlan, currentMetrics);
      setRecommendations(recs);
      // Pre-seleccionar todas las mejoras por defecto
      setSelectedImprovements(recs.improvements.map((imp: Recommendation) => imp.id));
      setShowPanel(true);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      alert("Hubo un error al generar las recomendaciones. Por favor, intenta de nuevo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
      const improvementsToApply = recommendations?.improvements.filter(imp => selectedImprovements.includes(imp.id));
      if(improvementsToApply && improvementsToApply.length > 0) {
        onOptimize(improvementsToApply);
      }
  };

  if (!showPanel) {
    return (
      <div className="bg-yellow-900/30 border border-yellow-500/40 rounded-lg p-4 mb-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-yellow-300 font-semibold text-lg flex items-center gap-2">
                <SparkleIcon className="w-5 h-5"/> Métricas de Calidad Mejorables
            </h3>
            <p className="text-yellow-200 text-sm">
              Potencial Viral: <span className="font-bold">{currentMetrics.viral_potential.toFixed(1)}/10</span> • 
              Autenticidad: <span className="font-bold">{currentMetrics.human_authenticity.toFixed(2)}%</span>
            </p>
          </div>
          <button 
            onClick={generateRecommendations}
            disabled={isAnalyzing}
            className="w-full sm:w-auto bg-yellow-600 text-white px-5 py-2.5 rounded-lg hover:bg-yellow-500 transition-colors font-bold flex items-center justify-center gap-2 disabled:bg-yellow-800"
          >
            {isAnalyzing ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
            {isAnalyzing ? 'Analizando...' : 'Optimizar con IA'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6 mb-6 animate-fade-in">
      <h3 className="text-xl font-bold text-blue-300 mb-4">
        🚀 Optimizador de Métricas Premium
      </h3>
      
      {recommendations && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-black/20 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-300">Potencial Viral</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-bold text-red-400">{currentMetrics.viral_potential.toFixed(1)}</span>
                <span className="text-gray-400 text-xl">→</span>
                <span className="text-xl font-bold text-green-400">{recommendations.projected_viral.toFixed(1)}</span>
              </div>
            </div>
            <div className="bg-black/20 p-3 rounded-lg text-center">
              <div className="text-sm text-gray-300">Autenticidad Humana</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-bold text-red-400">{currentMetrics.human_authenticity.toFixed(2)}%</span>
                <span className="text-gray-400 text-xl">→</span>
                <span className="text-xl font-bold text-green-400">{recommendations.projected_authenticity.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            <h4 className="font-semibold text-blue-200">💡 Mejoras Recomendadas:</h4>
            {recommendations.improvements.map((improvement) => (
              <label key={improvement.id} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedImprovements.includes(improvement.id)}
                  onChange={(e) => {
                    setSelectedImprovements(prev => 
                      e.target.checked ? [...prev, improvement.id] : prev.filter(id => id !== improvement.id)
                    );
                  }}
                  className="mt-1 h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-grow">
                  <div className="font-medium text-white">{improvement.title}</div>
                  <div className="text-sm text-gray-400">{improvement.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-700/50">
            <button
              onClick={() => setShowPanel(false)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              disabled={selectedImprovements.length === 0 || isOptimizing}
              className="flex-grow bg-green-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
               {isOptimizing ? <Spinner className="w-5 h-5"/> : <SparkleIcon className="w-5 h-5" />}
               {isOptimizing ? 'Aplicando Mejoras...' : `Aplicar ${selectedImprovements.length} Mejora(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};