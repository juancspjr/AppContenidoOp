/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// --- Base Types ---
export interface InitialConcept {
    idea: string;
    targetAudience: string;
    keyElements: string[];
    selectedTextModel: string;
    selectedImageModel: string;
}

export interface StyleAndFormat {
    outputFormat?: string[];
    narrativeStyle?: string[];
    visualStyle?: string[];
    narrativeStructure?: string[];
    hook?: string[];
    conflict?: string[];
    ending?: string[];
    energyLevel: number;
    styleNotes?: string;
}

export type CharacterRole = 'Protagonista' | 'Antagonista' | 'Mentor' | 'Aliado' | 'Personaje de Contraste (Foil)' | 'Secundario' | 'Interés Romántico' | 'Catalizador' | 'Fuerza de la Naturaleza' | 'Otro';

export interface CharacterMotivation {
    desire: string;
    fear: string;
    need: string;
}

export interface CharacterRelationship {
    characterId: string;
    relationship: string;
}

export interface CharacterDefinition {
    id: string;
    name: string;
    description: string;
    role: CharacterRole;
    motivation: CharacterMotivation;
    flaw: string;
    arc: string;
    relationships: CharacterRelationship[];
    visual_prompt_enhancers: string;
    imageFile?: File;
    imageAssetId?: string;
    imageUrl?: string; // transient, for UI display
}

export interface StoryStructure {
    act1_summary: string;
    act2_summary: string;
    act3_summary: string;
}


// --- Agent & Premium Types ---

export interface EnhancementMetadata {
    agents_applied: string[];
    processing_time: number;
    quality_score: number;
    process_log: any[];
}

export interface EnhancedStoryData {
    psychological_layers: any[];
    cultural_elements: any[];
    historical_depth: any[];
    narrative_innovations: any[];
    viral_hooks: any[];
    humanization_score: number;
    enhancement_metadata: EnhancementMetadata;
}

export interface Scene {
    scene_number: number;
    title: string;
    summary: string;
    emotional_beat: string;
    characters_present: string[];
    visual_description: string;
    dialogue_snippet?: string;
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
        narrative_style: string;
        visual_style: string;
    };
    characters: CharacterDefinition[];
    story_structure: {
        narrative_arc: Act[];
    };
}


export interface PremiumStoryPlan extends StoryMasterplan {
    enhanced_metadata?: {
        viral_potential: number;
        human_authenticity: number;
    };
    agent_contributions?: {
        psychology_insights: string[];
        viral_optimizations: string[];
    };
}

export interface AiProductionGuidePrompts {
    [key: string]: any;
}


export interface PremiumDocumentation {
    narrativeStory?: string;
    aiProductionGuide?: AiProductionGuidePrompts;
    directorsBible?: string;
    visualStyleGuide?: string;
    literaryScript?: string;
}


// --- Asset & Progress Types ---
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
    id: string;
    sceneNumber: number;
    narrativeText: string;
    shotType: string;
    cameraAngle: string;
    visualPrompt: string;
    assetId: string;
    generationStatus?: 'pending' | 'generating' | 'complete' | 'error';
}


export interface FinalAsset {
    assetId: string;
    type: 'video' | 'animated_image' | 'static_image';
    sceneId: string;
}
export interface FinalAssets {
    assets: FinalAsset[];
}


export interface ProgressUpdate {
    status: 'generating' | 'polling' | 'complete' | 'error';
    progress?: number; // 0-100 for generation
    message?: string;
    assetId?: string;
}


// --- NEW Real-time Progress Types ---
export interface AgentProgressStep {
    agent: string;
    step: number;
    total: number;
    description: string;
    status: 'pending' | 'processing' | 'complete' | 'error';
    timestamp: string;
    result?: any;
    errorMessage?: string;
}

export interface ProcessLog extends LogEntry {
    agent?: string;
    data?: any;
}


// --- Utility & State Types ---
export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
    component: string;
    message: string;
    details?: any;
}

export interface StyleSuggestions {
    justificacion: string;
    outputFormat?: string[];
    narrativeStyle?: string[];
    visualStyle?: string[];
    narrativeStructure?: string[];
    hook?: string[];
    conflict?: string[];
    ending?: string[];
}

export interface CoherenceCheckStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    result?: any;
    error?: string;
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
    improvement_strategies: Array<{
        id: string;
        title: string;
        description: string;
    }>;
}

export interface ExportedProject {
    phase: number;
    initialConcept: InitialConcept | null;
    styleAndFormat: StyleAndFormat | null;
    characters: CharacterDefinition[];
    storyStructure: StoryStructure | null;
    enhancedData: EnhancedStoryData | null;
    premiumPlan: PremiumStoryPlan | null;
    premiumDocumentation: PremiumDocumentation | null;
    finalEvaluation: any | null; // Define properly if structure is known
    storyPlan?: StoryMasterplan | PremiumStoryPlan | null; // For new projects
    plan?: any; // For legacy projects
    referenceAssets: ReferenceAssets | null;
    storyboardAssets: StoryboardPanel[] | null;
    finalAssets: FinalAssets | null;
}

export type StoryBuilderState = ExportedProject & {
    isLoading?: boolean;
    isAssisting?: boolean;
    error?: string | null;
    assistingCharacterIds?: Set<string>;
    progress?: Record<string, ProgressUpdate>;
    agentProgress?: AgentProgressStep[];
    currentAgent?: string;
    logs?: ProcessLog[];
    isOptimizing?: boolean;
    isSuggestingStyle?: boolean;
    styleSuggestions?: StyleSuggestions | null;
};