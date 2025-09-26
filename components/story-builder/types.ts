/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { characterRoles } from './constants';

export type CharacterRole = typeof characterRoles[number]['name'];

export interface InitialConcept {
    idea: string;
    targetAudience: string;
    keyElements: string[];
    selectedTextModel?: string;
    selectedImageModel?: string;
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
    role: CharacterRole;
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

export interface Critique {
    narrative_score: number;
    viral_score: number;
    integrated_score: number;
    strengths: string[];
    weaknesses: Array<{
        point: string;
        suggestion: string;
        severity: 'Minor' | 'Moderate' | 'High';
    }>;
    viral_moments: string[];
    improvement_strategies: Array<{ id: string; title: string; description: string }>;
}

// --- New Professional Dossier and Prompt Structures ---

export interface CharacterMasterPrompt {
    base_description_es: string;
    base_description_en: string;
    physical_details: {
        age: string;
        ethnicity: string;
        height: string;
        build: string;
        hair: string;
        eyes: string;
        skin: string;
    };
    wardrobe_evolution: {
        early_scenes: string;
        mid_scenes: string;
        final_scenes: string;
    };
    lighting_preference: string;
    emotional_states: {
        vulnerable: string;
        determined: string;
        authentic: string;
    };
}

export interface StoryboardPanelPrompt {
    scene_title: string;
    description_es: string;
    description_en: string;
    dialogue_es: string;
    dialogue_en: string;
    camera_angle: string;
    lighting_specific: string;
    props: string;
    mood: string;
}

export interface StoryboardGroupPrompt {
    total_scenes: number;
    aspect_ratio: string;
    canvas_size: string;
    division_strategy: string;
    global_style: {
        aesthetic: string;
        lighting: string;
        color_palette: string;
        consistency: string;
    };
    individual_panels: Record<string, StoryboardPanelPrompt>; // e.g., "panel_1": {...}
}

export interface AiProductionGuidePrompts {
    character_master_prompts: Record<string, CharacterMasterPrompt>; // e.g., "elena_rodriguez": {...}
    storyboard_groups: Record<string, StoryboardGroupPrompt>; // e.g., "group_1_setup": {...}
    negative_prompts: {
        character_consistency: string[];
        technical_quality: string[];
        scene_specific: string[];
    };
    audio_generation_prompts: {
        opening_theme_es: string;
        opening_theme_en: string;
        marcus_theme_es: string;
        marcus_theme_en: string;
        community_theme_es: string;
        community_theme_en: string;
    };
}

export interface Documentation {
    // These are strings containing Markdown content
    directorsBible: string;
    visualStyleGuide: string;
    narrativeStory: string;
    literaryScript: string;
    readme: string;
    // This is now a structured object
    aiProductionGuide: {
        prompts: AiProductionGuidePrompts;
    };
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

export interface StoryboardPanel {
    id: string; // e.g., 'panel_1'
    sceneNumber: number;
    assetId: string; // The ID of the sliced image blob in IndexedDB
    prompt: string;
    narrativeText: string;
    generationStatus: 'pending' | 'generating' | 'complete' | 'error';
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

export interface CritiqueProgressStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'complete' | 'error';
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
    critiqueStage: 'alpha' | 'beta' | 'approved' | null;
    critiqueProgress: CritiqueProgressStep[] | null;
    documentation: Documentation | null;
    referenceAssets: ReferenceAssets | null;
    storyboardAssets: StoryboardPanel[] | null;
    finalAssets: FinalAssets | null;
    plan?: any; // For legacy support
}

export type StoryBuilderState = Omit<ExportedProject, 'plan'>;

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