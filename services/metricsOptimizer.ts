/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { geminiService } from './geminiService';
import { parseJsonMarkdown } from '../utils/parserUtils';
import { SYSTEM_INSTRUCTION_CRITIC, SYSTEM_INSTRUCTION_DIRECTOR, metricsOptimizationSuggestionsSchema, storyPlanCorrectionSchema } from './prompts';
import type { PremiumStoryPlan } from '../components/story-builder/types';

/**
 * Analiza un plan de historia y sus métricas actuales para sugerir mejoras específicas.
 * @param storyPlan El plan de historia actual.
 * @param currentMetrics Las métricas actuales a mejorar.
 * @returns Un objeto con métricas proyectadas y una lista de mejoras sugeridas.
 */
export const analyzeMetricsAndSuggestImprovements = async (storyPlan: PremiumStoryPlan, currentMetrics: { viral_potential: number; human_authenticity: number; }) => {
  const prompt = `
  SYSTEM_TASK: ANALYZE AND SUGGEST IMPROVEMENTS.
  
  CURRENT STORY PLAN:
  ${JSON.stringify({
    metadata: storyPlan.metadata,
    creative_brief: storyPlan.creative_brief,
    characters: storyPlan.characters.map(c => c.name),
    structure_summary: storyPlan.story_structure.narrative_arc.map(a => a.summary)
  }, null, 2)}

  CURRENT METRICS:
  - Viral Potential: ${currentMetrics.viral_potential.toFixed(1)}/10 (LOW)
  - Human Authenticity: ${currentMetrics.human_authenticity.toFixed(2)}% (VERY LOW)

  YOUR GOAL: Generate specific, actionable recommendations to dramatically improve these metrics. Focus on:
  1.  **Viral Hooks**: Add or enhance opening hooks, surprising twists, or emotionally resonant moments.
  2.  **Authenticity**: Suggest deeper character motivations, more natural dialogue, or culturally specific details that feel real.
  3.  **Narrative Pacing**: Identify parts that could be faster or slower to improve retention.

  Provide your response in JSON format.
  `;

  const response = await geminiService.generateContent({
    contents: prompt,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_CRITIC,
        responseMimeType: 'application/json',
        responseSchema: metricsOptimizationSuggestionsSchema,
    }
  });
  
  return parseJsonMarkdown(response.text);
};

/**
 * Reescribe un plan de historia aplicando un conjunto seleccionado de mejoras.
 * @param storyPlan El plan de historia original.
 * @param selectedImprovements Un array de objetos de mejora seleccionados por el usuario.
 * @returns El plan de historia completo y optimizado.
 */
export const optimizeStoryMetrics = async (storyPlan: PremiumStoryPlan, selectedImprovements: any[]) => {
  const prompt = `
  SYSTEM_TASK: REWRITE AND OPTIMIZE STORY PLAN.

  ORIGINAL STORY PLAN:
  ${JSON.stringify(storyPlan, null, 2)}

  SELECTED IMPROVEMENTS TO APPLY:
  ${JSON.stringify(selectedImprovements, null, 2)}

  INSTRUCTIONS:
  1.  **Rewrite** the relevant sections of the original story plan to implement the selected improvements.
  2.  **Do Not Change** the core structure, character count, or fundamental plot. Enhance, don't replace.
  3.  **Update Metrics**: In the 'enhanced_metadata', update 'viral_potential' and 'human_authenticity' to reflect the projected improvements.
  4.  **Return the complete, rewritten PremiumStoryPlan object in JSON format.** Ensure the output is a single, valid JSON object.
  `;

  const response = await geminiService.generateContent({
    contents: prompt,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: storyPlanCorrectionSchema,
    }
  });
  
  return parseJsonMarkdown(response.text) as PremiumStoryPlan;
};