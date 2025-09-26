/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { z } from 'zod';
import type { 
    StructuralCoherenceReport, CoherenceCheckStep, StoryMasterplan, 
    Critique, CharacterDefinition, Act, Scene,
    ReferenceAsset
} from '../components/story-builder/types';
import { logger } from './logger';

export type TypeGuard<T> = (item: any) => item is T;

// --- Schemas Base ---
const CharacterSchema = z.object({
    id: z.string(),
    name: z.string().default('Personaje sin nombre'),
    role: z.string().default('Secundario'),
    description: z.string().default('Sin descripción'),
}).passthrough();

const SceneSchema = z.object({
    scene_number: z.number(),
    title: z.string().default('Escena sin título'),
    summary: z.string().default('Sin resumen'),
}).passthrough();

const ActSchema = z.object({
    act_number: z.number(),
    title: z.string().default('Acto sin título'),
    scenes: z.array(SceneSchema.or(z.null())).optional(),
}).passthrough();

const CoherenceCheckSchema = z.object({
    id: z.string(),
    element: z.string(),
    concern: z.string(),
    suggestion: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
});

const ProgressStepSchema = z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(['pending', 'running', 'complete', 'error']),
}).passthrough();

const WeaknessSchema = z.object({
    point: z.string(),
    suggestion: z.string(),
    severity: z.enum(['Minor', 'Moderate', 'High']),
});

const StrategySchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
});

// FIX: Add ReferenceAssetSchema for validation.
const ReferenceAssetSchema = z.object({
    id: z.string(),
    type: z.enum(['character', 'environment', 'element', 'scene_frame']),
    name: z.string(),
    description: z.string(),
    visualPrompt: z.string(),
    assetId: z.string(),
    generationStatus: z.enum(['pending', 'generating', 'complete', 'error']).optional(),
});


// --- Schemas Principales ---
export const StructuralCoherenceReportSchema = z.object({
    coherenceScore: z.number().default(0),
    overallAssessment: z.string().default('No disponible'),
    checks: z.array(CoherenceCheckSchema.or(z.null())).default([]),
});

export const StoryMasterplanSchema = z.object({
    metadata: z.object({}).passthrough().default({}),
    creative_brief: z.object({}).passthrough().default({}),
    characters: z.array(CharacterSchema.or(z.null())).optional().default([]),
    story_structure: z.object({
        narrative_arc: z.array(ActSchema.or(z.null())).optional().default([]),
    }).passthrough().default({ narrative_arc: [] }),
}).passthrough();

// FIX: Corrected CritiqueSchema to match the Critique type definition, using snake_case and including all properties.
export const CritiqueSchema = z.object({
    narrative_score: z.number().default(0),
    viral_score: z.number().default(0),
    integrated_score: z.number().default(0),
    strengths: z.array(z.string()).default([]),
    weaknesses: z.array(WeaknessSchema.or(z.null())).default([]),
    viral_moments: z.array(z.string()).default([]),
    improvement_strategies: z.array(StrategySchema.or(z.null())).default([]),
}).passthrough();

// --- Type Guards ---
export const isCharacter = (item: any): item is CharacterDefinition => CharacterSchema.safeParse(item).success;
export const isAct = (item: any): item is Act => ActSchema.safeParse(item).success;
export const isScene = (item: any): item is Scene => SceneSchema.safeParse(item).success;
export const isCheck = (item: any): item is StructuralCoherenceReport['checks'][0] => CoherenceCheckSchema.safeParse(item).success;
export const isProgressStep = (item: any): item is CoherenceCheckStep => ProgressStepSchema.safeParse(item).success;
export const isWeakness = (item: any): item is Critique['weaknesses'][0] => WeaknessSchema.safeParse(item).success;
// FIX: Corrected the type guard to use the correct snake_case property name from the Critique type.
export const isStrategy = (item: any): item is Critique['improvement_strategies'][0] => StrategySchema.safeParse(item).success;
// FIX: Add isReferenceAsset type guard.
export const isReferenceAsset = (item: any): item is ReferenceAsset => ReferenceAssetSchema.safeParse(item).success;

// --- Función de Parseo Seguro ---
export function safeParseWithDefaults<T extends z.ZodTypeAny>(
  data: unknown,
  schema: T,
  options: {
    preservePartial?: boolean;
    notifyUser?: boolean;
    context?: string;
  } = {}
): z.infer<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return result.data;
  }
  
  // NEW: Attempt partial recovery
  // FIX: Add guard to ensure schema is a ZodObject before calling .partial(), which only exists on object types.
  if (options.preservePartial && typeof data === 'object' && data !== null && schema instanceof z.ZodObject) {
    const partialSchema = schema.partial();
    const partialResult = partialSchema.safeParse(data);
    
    if (partialResult.success) {
      const defaults = schema.parse({});
      
      // Filter out undefined values from partial result to avoid overwriting defaults
      const validPartialData = Object.entries(partialResult.data).reduce((acc, [key, value]) => {
          if (value !== undefined) {
              (acc as any)[key] = value;
          }
          return acc;
      }, {});

      // FIX: Ensure 'defaults' is an object before spreading. The instance of check above guarantees this.
      const recovered = { ...defaults, ...validPartialData };
      
      if (options.notifyUser) {
        logger.log('INFO', options.context || 'Validation', 'Datos parcialmente recuperados tras fallo de validación.', {
          recovered: Object.keys(validPartialData),
          lost: Object.keys(defaults).filter(k => !(k in validPartialData))
        });
      }
      
      return recovered;
    }
  }
  
  // Last resort: full defaults
  logger.log('ERROR', options.context || 'Validation', 'Validación fallida y recuperación parcial imposible. Usando valores por defecto completos.', {
    error: result.error.flatten(),
    rawData: data,
  });
  return schema.parse({});
}