/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { z } from 'zod';

// Phase 1: Initial Concept
export const InitialConceptSchema = z.object({
    idea: z.string().min(1, "La idea es requerida."),
    targetAudience: z.string(),
    keyElements: z.array(z.string()),
});
export type InitialConcept = z.infer<typeof InitialConceptSchema>;


// Phase 2: Style & Format
export const StyleAndFormatSchema = z.object({
    outputFormat: z.array(z.string()).optional(),
    narrativeStyle: z.array(z.string()).optional(),
    visualStyle: z.array(z.string()).optional(),
    narrativeStructure: z.array(z.string()).optional(),
    hook: z.array(z.string()).optional(),
    conflict: z.array(z.string()).optional(),
    ending: z.array(z.string()).optional(),
    styleNotes: z.string().optional(),
});
export type StyleAndFormat = z.infer<typeof StyleAndFormatSchema>;


// Type for what the AI suggests in Phase 2
export const AIStyleSuggestionSchema = z.object({
    outputFormat: z.array(z.string()).optional(),
    narrativeStyle: z.array(z.string()).optional(),
    visualStyle: z.array(z.string()).optional(),
    narrativeStructure: z.array(z.string()).optional(),
    hook: z.array(z.string()).optional(),
    conflict: z.array(z.string()).optional(),
    ending: z.array(z.string()).optional(),
    styleNotesSuggestion: z.string().optional(),
});
export type AIStyleSuggestion = z.infer<typeof AIStyleSuggestionSchema>;


// Phase 3: Characters
export const CharacterMotivationSchema = z.object({
    desire: z.string(),
    fear: z.string(),
    need: z.string(),
});
export type CharacterMotivation = z.infer<typeof CharacterMotivationSchema>;

export const CharacterRelationshipSchema = z.object({
    characterId: z.string(),
    relationshipType: z.string(),
});
export type CharacterRelationship = z.infer<typeof CharacterRelationshipSchema>;

export const CharacterDefinitionSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    archetype: z.string(),
    role: z.enum(['Protagonist', 'Antagonist', 'Mentor', 'Ally', 'Foil', 'Supporting', 'Other']),
    motivation: CharacterMotivationSchema,
    flaw: z.string(),
    arc: z.string(),
    relationships: z.array(CharacterRelationshipSchema),
    visual_prompt_enhancers: z.string(),
    imageFile: z.instanceof(File).optional(),
    imageUrl: z.string().optional(),
    imageAssetId: z.string().optional(),
});
export type CharacterDefinition = z.infer<typeof CharacterDefinitionSchema>;


// Phase 4: Story Structure
export const StoryStructureSchema = z.object({
    act1_summary: z.string().optional(),
    act2_summary: z.string().optional(),
    act3_summary: z.string().optional(),
});
export type StoryStructure = z.infer<typeof StoryStructureSchema>;


// Phase 4.5: Coherence Check
export const CoherenceCheckItemSchema = z.object({
    id: z.string(),
    element: z.string(),
    concern: z.string(),
    suggestion: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
});
export type CoherenceCheckItem = z.infer<typeof CoherenceCheckItemSchema>;

export const StructuralCoherenceReportSchema = z.object({
    coherenceScore: z.number(),
    overallAssessment: z.string(),
    checks: z.array(CoherenceCheckItemSchema),
});
export type StructuralCoherenceReport = z.infer<typeof StructuralCoherenceReportSchema>;

export const CoherenceCheckStepSchema = z.object({
    id: z.string(),
    label: z.string(),
    status: z.enum(['pending', 'running', 'complete', 'error']),
    result: z.string().optional(),
    error: z.string().optional(),
});
export type CoherenceCheckStep = z.infer<typeof CoherenceCheckStepSchema>;


// Phase 5: Story Masterplan
export const SceneSchema = z.object({
    scene_number: z.number(),
    title: z.string(),
    summary: z.string(),
    visual_description: z.string().optional(),
    dialogue: z.string().optional(),
    sound_design: z.string().optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ActSchema = z.object({
    act_number: z.number(),
    title: z.string(),
    summary: z.string(),
    scenes: z.array(SceneSchema),
});
export type Act = z.infer<typeof ActSchema>;

export const StoryMasterplanSchema = z.object({
    metadata: z.object({
        title: z.string(),
        logline: z.string(),
    }),
    story_structure: z.object({
        narrative_arc: z.array(ActSchema),
    }),
});
export type StoryMasterplan = z.infer<typeof StoryMasterplanSchema>;


// Phase 6.1: Critique
export const CritiqueSchema = z.object({
    narrativeStrengths: z.array(z.string()),
    weaknesses: z.array(z.object({ point: z.string(), suggestion: z.string() })),
    viralPotential: z.number(),
    improvementStrategies: z.array(z.object({ title: z.string(), description: z.string() })),
    enrichedElements: z.any(),
});
export type Critique = z.infer<typeof CritiqueSchema>;


// Phase 6.2: Documentation
export const DocumentationSchema = z.object({
    directorsBible: z.string(),
    aiProductionGuide: z.string(),
    visualStyleGuide: z.string(),
});
export type Documentation = z.infer<typeof DocumentationSchema>;


// Phase 6.2.5: Hook Matrix
export const HookTemplateSchema = z.object({
    template: z.string(),
    rationale: z.string(),
});
export type HookTemplate = z.infer<typeof HookTemplateSchema>;

export const HookMatrixSchema = z.object({
    patternInterrupts: z.array(HookTemplateSchema),
    psychologicalTriggers: z.array(HookTemplateSchema),
    curiosityGaps: z.array(HookTemplateSchema),
    powerPhrases: z.array(HookTemplateSchema),
    provenStructures: z.array(HookTemplateSchema),
});
export type HookMatrix = z.infer<typeof HookMatrixSchema>;


// Phase 6.3: Reference Assets
export const ReferenceAssetSchema = z.object({
    id: z.string(),
    type: z.enum(['character', 'environment', 'element']),
    name: z.string(),
    description: z.string(),
    prompt: z.string(),
    assetId: z.string(),
    generationStatus: z.enum(['pending', 'generating', 'complete', 'error']),
    aspectRatio: z.enum(['1:1', '16:9', '9:16']),
});
export type ReferenceAsset = z.infer<typeof ReferenceAssetSchema>;

export const ReferenceAssetsSchema = z.object({
    characters: z.array(ReferenceAssetSchema),
    environments: z.array(ReferenceAssetSchema),
    elements: z.array(ReferenceAssetSchema),
});
export type ReferenceAssets = z.infer<typeof ReferenceAssetsSchema>;


// Phase 6.4: Final Video Generation
export const VideoAssetSchema = z.object({
    sceneId: z.string(),
    segment: z.number(),
    assetId: z.string(),
});
export type VideoAsset = z.infer<typeof VideoAssetSchema>;

export const FinalAssetsSchema = z.object({
    videoAssets: z.array(VideoAssetSchema),
});
export type FinalAssets = z.infer<typeof FinalAssetsSchema>;


// --- Utility & State Machine Types ---
export const ProgressUpdateSchema = z.object({
    stage: z.string(),
    message: z.string(),
    progress: z.number().optional(),
    segment: z.number().optional(),
    totalSegments: z.number().optional(),
    sceneId: z.string().optional(),
    status: z.enum(['in_progress', 'complete', 'error']),
});
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;


export const ExportedProjectSchema = z.object({
    phase: z.number(),
    initialConcept: InitialConceptSchema.nullable(),
    styleAndFormat: StyleAndFormatSchema.nullable(),
    characters: z.array(CharacterDefinitionSchema),
    storyStructure: StoryStructureSchema.nullable(),
    coherenceReport: StructuralCoherenceReportSchema.nullable(),
    storyPlan: StoryMasterplanSchema.nullable(),
    plan: StoryMasterplanSchema.optional(), // For legacy
    critique: CritiqueSchema.nullable(),
    documentation: DocumentationSchema.nullable(),
    hookMatrix: HookMatrixSchema.nullable(),
    referenceAssets: ReferenceAssetsSchema.nullable(),
    finalAssets: FinalAssetsSchema.nullable(),
    isLoading: z.boolean().optional(),
    error: z.string().nullable().optional(),
    progress: z.record(z.string(), ProgressUpdateSchema).optional(),
});
export type ExportedProject = z.infer<typeof ExportedProjectSchema>;


// For AdjustmentPanel
export interface AIRecommendation {
    presetName?: string;
    reason: string;
    colorBalance?: { r: number, g: number, b: number };
}