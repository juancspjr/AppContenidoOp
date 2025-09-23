/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// FIX: Added full type definitions to make this a valid and useful module.

export interface InitialConcept {
    idea: string;
    targetAudience: string;
    keyElements: string[];
}

export interface StyleAndFormat {
    outputFormat?: string[];
    narrativeStyle?: string[];
    visualStyle?: string[];
    narrativeStructure?: string[];
    hook?: string[];
    conflict?: string[];
    ending?: string[];
    energyLevel?: number;
    styleNotes?: string;
}

export interface CharacterMotivation {
    desire: string;
    fear: string;
    need: string;
}

export interface CharacterRelationship {
    characterId: string;
    relationshipType: string;
    description: string;
}

export interface CharacterDefinition {
    id: string;
    name: string;
    role: 'Protagonist' | 'Antagonist' | 'Mentor' | 'Ally' | 'Foil' | 'Supporting' | 'Other';
    description: string;
    motivation: CharacterMotivation;
    flaw: string;
    arc: string;
    relationships: CharacterRelationship[];
    visual_prompt_enhancers: string;
    imageFile?: File;
    imageUrl?: string;
    imageAssetId?: string;
}

export interface StoryStructure {
    act1_summary?: string;
    act2_summary?: string;
    act3_summary?: string;
}

export interface CoherenceCheckStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    result?: string;
}

export interface StructuralCoherenceReport {
    coherenceScore: number;
    overallAssessment: string;
    checks: Array<{
        id: string;
        element: string;
        concern: string;
        suggestion: string;
        severity: 'low' | 'medium' | 'high';
    }>;
}

export interface Scene {
    scene_number: number;
    title: string;
    summary: string;
    emotional_beat: string;
    characters_present: string[];
    visual_elements_prompt?: string;
}

export interface Act {
    act_number: number;
    title: string;
    summary: string;
    scenes: Scene[];
}

export interface StoryMasterplan {
    metadata: {
        title: string;
        logline: string;
        theme: string;
    };
    creative_brief: {
        concept: string;
        target_audience: string;
        output_format: string[];
        narrative_style: string[];
        visual_style: string[];
    };
    characters: Array<{
        name: string;
        role: string;
        description: string;
        visual_description: string;
    }>;
    story_structure: {
        narrative_arc: Act[];
    };
    critique?: Critique;
}

export interface EnrichedElements {
    characters?: any[];
    actions?: any[];
    environments?: any[];
    narratives?: any[];
    visuals?: any[];
    technicals?: any[];
}

export interface Critique {
    narrativeStrengths: string[];
    weaknesses: Array<{ point: string; suggestion: string }>;
    improvementStrategies: Array<{ title: string; description: string }>;
    viralPotential: number;
    enrichedElements: EnrichedElements;
}

export interface Documentation {
    aiProductionGuide: string;
    directorsBible: string;
    visualStyleGuide: string;
}

export interface HookTemplate {
    template: string;
    rationale: string;
}

export interface HookMatrix {
    patternInterrupts: HookTemplate[];
    psychologicalTriggers: HookTemplate[];
    curiosityGaps: HookTemplate[];
    powerPhrases: HookTemplate[];
    provenStructures: HookTemplate[];
}

export interface ReferenceAsset {
    id: string;
    type: 'character' | 'environment' | 'element' | 'scene_frame';
    name: string;
    description: string;
    visualPrompt: string;
    assetId: string;
    generationStatus?: 'pending' | 'generating' | 'complete' | 'error';
}

export interface ReferenceAssets {
    characters: ReferenceAsset[];
    environments: ReferenceAsset[];
    elements: ReferenceAsset[];
    sceneFrames: ReferenceAsset[];
}

export interface FinalAsset {
    sceneId: string;
    type: 'video' | 'animated_image' | 'static_image';
    assetId: string;
}

export interface FinalAssets {
    assets: FinalAsset[];
}

export interface ProgressUpdate {
    status: string;
    progress?: number;
    message?: string;
}

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
    plan?: any; // For legacy support
}

// FIX: Add missing Gemini API response types to resolve compilation errors.
export interface GenerateImagesResponse {
    generatedImages: Array<{
        image: {
            imageBytes: string;
            uri: string;
        };
    }>;
}

export interface VideosOperationResponse {
    done: boolean;
    name?: string;
    response?: {
        generatedVideos?: Array<{
            video?: {
                uri: string;
            };
        }>;
    };
    error?: any;
    metadata?: any;
}
