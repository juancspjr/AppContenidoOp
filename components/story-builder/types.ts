/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { z } from 'zod';

// For AdjustmentPanel AI Recommendations
export interface AIRecommendation {
    presetName: string;
    reason: string;
    confidence: number;
    colorBalance?: { r: number; g: number; b: number; };
}

// =================================================================
// STORY BUILDER CORE TYPES
// =================================================================

// Phase 1: Initial user input
export interface InitialConcept {
    idea: string;
    targetAudience?: string;
    keyElements?: string[];
    logline?: string;
}

// Zod Schema for AI Concept Generation (Phase 1)
export const InitialConceptSchema = z.object({
    idea: z.string(),
    targetAudience: z.string().optional(),
    keyElements: z.array(z.string()).optional(),
    logline: z.string().optional(),
});


// Phase 2: User input
export interface StyleAndFormat {
    outputFormat?: string[];
    narrativeStyle?: string[];
    visualStyle?: string[];
    narrativeStructure?: string[];
    hook?: string[];
    conflict?: string[];
    ending?: string[];
    styleNotes?: string;
}

// Zod Schema for AI Style Suggestions (Phase 2)
export const AIStyleSuggestionSchema = z.object({
    outputFormat: z.array(z.string()).max(3),
    narrativeStyle: z.array(z.string()).max(3),
    visualStyle: z.array(z.string()).max(3),
    narrativeStructure: z.array(z.string()).max(3).optional(),
    hook: z.array(z.string()).max(3).optional(),
    conflict: z.array(z.string()).max(3).optional(),
    ending: z.array(z.string()).max(3).optional(),
    styleNotesSuggestion: z.string().optional(),
}).partial();


// Phase 3: User input - ELITE "Chain of Agents" STRUCTURE
export interface CharacterRelationship {
    characterId: string; // ID of the character this one is related to
    relationshipType: string; // e.g., "Rival", "Mentor", "Ally", "Family", "Romantic Interest"
}

export interface CharacterMotivation {
    desire: string; // What the character wants.
    fear: string;   // What the character is afraid of.
    need: string;   // What the character truly needs to learn or accept.
}

export interface CharacterDefinition {
    id: string; // Unique identifier for relationships
    name: string;
    description: string;
    role: 'Protagonist' | 'Antagonist' | 'Mentor' | 'Ally' | 'Foil' | 'Supporting' | 'Other';
    archetype?: string;
    motivation: CharacterMotivation;
    flaw: string; // The character's critical weakness
    arc: string; // The character's transformation, e.g., "From coward to hero"
    relationships: CharacterRelationship[];
    visual_prompt_enhancers: string; // Keywords for AI image generation, e.g. "red scarf, scar over left eye"
    imageUrl?: string; 
    imageAssetId?: string;
    imageFile?: File;
}

// Zod Schema for AI Character Assistance (Phase 3)
export const AICharacterDetailsSchema = z.object({
    description: z.string(),
    motivation: z.object({
        desire: z.string(),
        fear: z.string(),
        need: z.string(),
    }),
    flaw: z.string(),
    arc: z.string(),
    visual_prompt_enhancers: z.string(),
}).partial();


// Phase 4: User input
export interface StoryStructure {
    act1_summary?: string;
    act2_summary?: string;
    act3_summary?: string;
}

// Zod Schema for AI Story Structure Generation (Phase 4)
export const AIStoryStructureSchema = z.object({
    act1_summary: z.string(),
    act2_summary: z.string(),
    act3_summary: z.string(),
}).partial();


// Phase 4.5: AI-generated coherence check report
export interface CoherenceCheckItem {
    id: string; // Unique ID for managing selection state
    element: string; // e.g., "Tone vs. Character", "Plot Hole"
    concern: string;
    suggestion: string;
    severity: 'low' | 'medium' | 'high';
}

export interface StructuralCoherenceReport {
    overallAssessment: string;
    coherenceScore: number; // 0-10
    checks: CoherenceCheckItem[];
}

export interface CoherenceCheckStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    result?: string; // For summary or score
    error?: string;
}


// Zod Schema for validation
export const CoherenceCheckItemSchema = z.object({
    id: z.string().default(() => `check_${Date.now()}_${Math.random()}`),
    element: z.string().optional().default("General"),
    concern: z.string().optional().default("No specific concern provided."),
    suggestion: z.string().optional().default("No specific suggestion provided."),
    severity: z.enum(['low', 'medium', 'high']).optional().default('low'),
});

export const CoherenceCheckItemsSchema = z.array(CoherenceCheckItemSchema);


// Base schema with common fields
const BaseReportSchema = z.object({
    coherenceScore: z.number().min(0).max(10),
    checks: z.array(CoherenceCheckItemSchema),
});

// Union schema for the varying field ('overallAssessment' or 'summary')
const UnionKeySchema = z.union([
    z.object({ overallAssessment: z.string() }),
    z.object({ summary: z.string() })
]);

// Final schema that combines the base and union, then transforms the result
// to a consistent internal format. This makes the system resilient to API variations.
export const StructuralCoherenceReportSchema = BaseReportSchema.and(UnionKeySchema)
    .transform((data): StructuralCoherenceReport => {
        if ('summary' in data && data.summary) {
            // If 'summary' key exists, normalize it to 'overallAssessment'
            return {
                overallAssessment: data.summary,
                coherenceScore: data.coherenceScore,
                checks: data.checks,
            };
        }
        // Otherwise, the data already has 'overallAssessment' and is correct
        return data as StructuralCoherenceReport;
    });


// Generated by the "Scroll-Stopper" Hook Adapter Agent
export interface HookTemplate {
    template: string; // The actual hook text/concept
    rationale: string; // Why this hook works for this specific story
}
export interface HookMatrix {
    patternInterrupts: HookTemplate[];
    psychologicalTriggers: HookTemplate[];
    curiosityGaps: HookTemplate[];
    powerPhrases: HookTemplate[];
    provenStructures: HookTemplate[];
}


// =================================================================
// ZOD SCHEMAS for STORY MASTERPLAN (Phase 5) - NEW & CRITICAL
// =================================================================

const MetadataSchema = z.object({
    title: z.string(),
    logline: z.string(),
    theme: z.string(),
    version: z.string().optional(),
    generatedAt: z.string().optional(),
});

const CreativeBriefSchema = z.object({
    concept: z.string(),
    target_audience: z.string(),
    output_format: z.union([z.string(), z.array(z.string())]),
    narrative_style: z.union([z.string(), z.array(z.string())]),
    visual_style: z.union([z.string(), z.array(z.string())]),
});

const CharacterPlanSchema = z.object({
    name: z.string(),
    description: z.string(),
    visual_description: z.string(),
    role: z.string(),
    reference_asset_id: z.string().optional(),
});

const SceneSchema = z.object({
    scene_number: z.number(),
    title: z.string(),
    setting: z.string(),
    summary: z.string(),
    emotional_beat: z.string(),
    characters_present: z.array(z.string()),
    // CRITICAL IMPROVEMENT: Add a specific prompt for video generation per scene
    visual_elements_prompt: z.string().optional().describe("A detailed prompt for an AI video generator for this specific scene."),
});

const ActSchema = z.object({
    act_number: z.number(),
    title: z.string(),
    summary: z.string(),
    scenes: z.array(SceneSchema),
});

const StoryStructurePlanSchema = z.object({
    hook: z.object({
        type: z.string(),
        description: z.string(),
    }),
    narrative_arc: z.array(ActSchema),
    conflict: z.object({
        type: z.string(),
        description: z.string(),
    }),
    ending: z.object({
        type: z.string(),
        description: z.string(),
    }),
});

export const StoryMasterplanSchema = z.object({
    metadata: MetadataSchema,
    creative_brief: CreativeBriefSchema,
    characters: z.array(CharacterPlanSchema),
    story_structure: StoryStructurePlanSchema,
    critique: z.any().optional(), // Critique is added later, not validated here
    documentation: z.any().optional(), // Documentation is added later
    hookMatrix: z.any().optional(), // Hook Matrix is added later
});

// The comprehensive plan generated by the AI after phase 4
export type StoryMasterplan = z.infer<typeof StoryMasterplanSchema>;


// Phase 6.1: The AI's evaluation of the masterplan
export interface Critique {
    overallAssessment: string;
    viralPotential: number; // Score from 1-10
    narrativeStrengths: string[];
    weaknesses: Array<{
        point: string;
        suggestion: string;
    }>;
    improvementStrategies: Array<{
        title: string,
        description: string,
    }>;
    enrichedElements?: {
        characters?: any[];
        actions?: any[];
        environments?: any[];
        narratives?: any[];
        visuals?: any[];
        technicals?: any[];
    }
}

// Phase 6.2: Generated documentation
export interface Documentation {
    directorsBible: string;
    aiProductionGuide: string;
    visualStyleGuide: string;
}

// Phase 6.3: Generated reference assets
export interface ReferenceAsset {
    id: string; // e.g., "character_john_doe"
    type: 'character' | 'environment' | 'element';
    name: string;
    description: string;
    visualPrompt: string;
    assetId: string; // ID for retrieving blob from cache
    generationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
}
export interface ReferenceAssets {
    characters: ReferenceAsset[];
    environments: ReferenceAsset[];
    elements: ReferenceAsset[];
}

// Phase 6.4: Generated final video assets
export interface VideoAsset {
    sceneId: string; // "scene_1", "scene_2", etc.
    segment: number;
    totalSegments: number;
    assetId: string; // ID for retrieving blob from cache
}

export interface FinalAssets {
    videoAssets: VideoAsset[];
}

// For progress updates during long generation tasks
export interface ProgressUpdate {
    stage: string;
    status: 'pending' | 'in_progress' | 'complete' | 'error';
    message: string;
    progress?: number;
    sceneId?: string;
    segment?: number;
    totalSegments?: number;
}

// For exporting/importing/saving the whole project state
export interface ExportedProject {
    phase: number;
    initialConcept: InitialConcept | null;
    styleAndFormat: StyleAndFormat | null;
    characters: CharacterDefinition[];
    storyStructure: StoryStructure | null;
    coherenceReport: StructuralCoherenceReport | null;
    coherenceCheckProgress: CoherenceCheckStep[] | null;
    storyPlan: StoryMasterplan | null;
    critique: Critique | null;
    documentation: Documentation | null;
    hookMatrix: HookMatrix | null;
    referenceAssets: ReferenceAssets | null;
    finalAssets: FinalAssets | null;
    // Legacy support for older save format
    plan?: StoryMasterplan;
}