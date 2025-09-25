/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Type } from '@google/genai';
import type { 
    InitialConcept, StyleAndFormat, CharacterDefinition, 
    StoryStructure, StoryBuilderState, StoryMasterplan, Critique, StructuralCoherenceReport,
    AiProductionGuidePrompts
} from '../components/story-builder/types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from '../components/story-builder/constants';

// Helper to format options for the prompt
const formatOptionsForPrompt = (category: Record<string, any[]>) => {
    return Object.entries(category).map(([groupName, options]) => 
        `-- ${groupName} --\n` + options.map(opt => `* ${opt.value || opt.name} (${opt.description})`).join('\n')
    ).join('\n\n');
};

// --- System Instructions ---
const SYSTEM_INSTRUCTION_DIRECTOR = `You are an expert AI Film Director, Screenwriter, and Creative Producer, embodying the creative spirit of production houses like SIERRA and Hondo Studio, and drawing narrative depth from masters like Borges and visual storytelling from legends like Akira Toriyama. Your goal is to assist the user in building a complete, coherent, and compelling story from a simple idea to a full production plan. You are analytical, creative, and structured. You must always respond in the requested JSON format. For any content generated, provide it first in Spanish (ES), followed by an English (EN) translation.`;
const SYSTEM_INSTRUCTION_CRITIC = `You are a sharp, insightful, but constructive AI Story Critic and Viral Content Analyst, acting as a professional review panel. Your panel includes a Narrative Emotional Agent focusing on human impact and a Technical Structural Agent focused on consistency and pacing. Your task is to analyze a story plan and identify its strengths, weaknesses, and potential for viral success. You provide actionable, specific feedback with examples. You must always respond in the requested JSON format.`;
const SYSTEM_INSTRUCTION_ARTIST = `You are a world-class AI Concept Artist and Director of Photography, with the artistic sensibilities of masters like Eiichiro Oda. You translate narrative descriptions into rich, detailed, and evocative visual prompts for an image generation model. You are an expert in cinematography, lighting, composition, and art styles. For any JSON output, provide bilingual values for user-facing strings.`;

// --- JSON Schemas ---
const conceptSchema = {
    type: Type.OBJECT,
    properties: {
        idea: { type: Type.STRING, description: "The refined, core idea of the story in one compelling sentence." },
        targetAudience: { type: Type.STRING, description: "A more detailed description of the target audience." },
        keyElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 5-7 key thematic or visual elements." },
    },
    required: ['idea', 'targetAudience', 'keyElements']
};

const styleSchema = {
    type: Type.OBJECT,
    properties: {
        outputFormat: { type: Type.ARRAY, items: { type: Type.STRING } },
        narrativeStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
        visualStyle: { type: Type.ARRAY, items: { type: Type.STRING } },
        narrativeStructure: { type: Type.ARRAY, items: { type: Type.STRING } },
        hook: { type: Type.ARRAY, items: { type: Type.STRING } },
        conflict: { type: Type.ARRAY, items: { type: Type.STRING } },
        ending: { type: Type.ARRAY, items: { type: Type.STRING } },
        energyLevel: { type: Type.INTEGER },
        styleNotes: { type: Type.STRING },
    }
};

const characterSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        role: { type: Type.STRING },
        motivation: {
            type: Type.OBJECT,
            properties: {
                desire: { type: Type.STRING },
                fear: { type: Type.STRING },
                need: { type: Type.STRING },
            },
        },
        flaw: { type: Type.STRING },
        arc: { type: Type.STRING },
        visual_prompt_enhancers: { type: Type.STRING },
    },
};

const characterCastSchema = {
    type: Type.OBJECT,
    properties: {
        characters: {
            type: Type.ARRAY,
            items: characterSchema,
        },
    },
};

const structureSchema = {
    type: Type.OBJECT,
    properties: {
        act1_summary: { type: Type.STRING },
        act2_summary: { type: Type.STRING },
        act3_summary: { type: Type.STRING },
    },
    required: ['act1_summary', 'act2_summary', 'act3_summary']
};

const coherenceReportSchema = {
    type: Type.OBJECT,
    properties: {
        report: {
            type: Type.OBJECT,
            properties: {
                coherenceScore: { type: Type.NUMBER },
                overallAssessment: { type: Type.STRING },
                checks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            element: { type: Type.STRING },
                            concern: { type: Type.STRING },
                            suggestion: { type: Type.STRING },
                            severity: { type: Type.STRING },
                        }
                    }
                }
            }
        }
    }
};

const storyCorrectionSchema = {
    type: Type.OBJECT,
    properties: {
        initialConcept: { ...conceptSchema, description: 'The updated concept. Only include if changed.' },
        styleAndFormat: { ...styleSchema, description: 'The updated style. Only include if changed.' },
        characters: { type: Type.ARRAY, items: characterSchema, description: 'The updated list of characters. Return the full, updated list if any character is changed.'},
        storyStructure: { ...structureSchema, description: 'The updated structure. Only include if changed.' },
    },
};


const storyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        metadata: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "A creative and catchy title for the story." },
                logline: { type: Type.STRING, description: "A one-sentence summary of the story (character + goal + conflict)." },
                theme: { type: Type.STRING, description: "The central theme or message of the story." },
            },
            required: ['title', 'logline', 'theme']
        },
        creative_brief: {
            type: Type.OBJECT,
            properties: {
                concept: { type: Type.STRING },
                target_audience: { type: Type.STRING },
                output_format: { type: Type.ARRAY, items: { type: Type.STRING } },
                narrative_style: { type: Type.ARRAY, items: { type: Type.STRING } },
                visual_style: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
             required: ['concept', 'target_audience', 'output_format', 'narrative_style', 'visual_style']
        },
        characters: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    description: { type: Type.STRING, description: "A brief description of the character's personality and background." },
                    visual_description: { type: Type.STRING, description: "A detailed visual description for concept art generation." },
                },
                required: ['name', 'role', 'description', 'visual_description']
            }
        },
        story_structure: {
            type: Type.OBJECT,
            properties: {
                narrative_arc: {
                    type: Type.ARRAY,
                    items: { // Act
                        type: Type.OBJECT,
                        properties: {
                            act_number: { type: Type.INTEGER },
                            title: { type: Type.STRING, description: "A title for the act, e.g., 'The Setup'." },
                            summary: { type: Type.STRING, description: "A summary of the act's main events." },
                            scenes: {
                                type: Type.ARRAY,
                                items: { // Scene
                                    type: Type.OBJECT,
                                    properties: {
                                        scene_number: { type: Type.INTEGER },
                                        title: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        emotional_beat: { type: Type.STRING, description: "The key emotional shift or moment in the scene." },
                                        characters_present: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        visual_elements_prompt: { type: Type.STRING, description: "A concise prompt describing key visual elements for image generation." },
                                    },
                                    required: ['scene_number', 'title', 'summary', 'emotional_beat', 'characters_present', 'visual_elements_prompt']
                                },
                            },
                        },
                        required: ['act_number', 'title', 'summary', 'scenes']
                    },
                },
            },
             required: ['narrative_arc']
        },
    },
    required: ['metadata', 'creative_brief', 'characters', 'story_structure']
};
const critiqueSchema = {
    type: Type.OBJECT,
    properties: {
        narrativeStrengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of key strengths in the narrative."
        },
        weaknesses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    point: { type: Type.STRING, description: "The identified weakness." },
                    suggestion: { type: Type.STRING, description: "A concrete suggestion for improvement." },
                    severity: { type: Type.STRING, description: "Severity of the weakness: 'Minor', 'Moderate', or 'High'." },
                },
                required: ['point', 'suggestion', 'severity']
            },
            description: "A list of weaknesses and corresponding suggestions."
        },
        improvementStrategies: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique ID for the strategy, e.g., 'enhance_character_motivation'."},
                    title: { type: Type.STRING, description: "The title of the improvement strategy." },
                    description: { type: Type.STRING, description: "A detailed description of the strategy." },
                },
                required: ['id', 'title', 'description']
            },
            description: "A list of high-level strategies to improve the story."
        },
        viralPotential: {
            type: Type.NUMBER,
            description: "An estimated score from 0.0 to 10.0 for the story's viral potential."
        },
        enrichedElements: {
            type: Type.OBJECT,
            properties: {
                characters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for enriching characters." },
                actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for enriching actions/scenes." },
                environments: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for enriching environments." },
                narratives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for enriching the narrative." },
                visuals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for enriching the visuals." },
                technicals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggestions for technical improvements." },
            },
        }
    },
    required: ['narrativeStrengths', 'weaknesses', 'improvementStrategies', 'viralPotential', 'enrichedElements']
};

const improvementStrategiesSchema = {
    type: Type.OBJECT,
    properties: {
        improvementStrategies: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique ID for the strategy, e.g., 'add_viral_hook'." },
                    title: { type: Type.STRING, description: "The title of the improvement strategy." },
                    description: { type: Type.STRING, description: "A detailed description of the strategy." },
                },
                required: ['id', 'title', 'description']
            },
        }
    },
    required: ['improvementStrategies']
};

const hookTemplateSchema = {
    type: Type.OBJECT,
    properties: {
        template: { type: Type.STRING },
        rationale: { type: Type.STRING }
    },
    required: ['template', 'rationale']
};

const characterMasterPromptSchema = {
    type: Type.OBJECT,
    properties: {
        base_description_es: { type: Type.STRING },
        base_description_en: { type: Type.STRING },
        physical_details: {
            type: Type.OBJECT,
            properties: {
                age: { type: Type.STRING },
                ethnicity: { type: Type.STRING },
                height: { type: Type.STRING },
                build: { type: Type.STRING },
                hair: { type: Type.STRING },
                eyes: { type: Type.STRING },
                skin: { type: Type.STRING },
            }
        },
        wardrobe_evolution: {
            type: Type.OBJECT,
            properties: {
                early_scenes: { type: Type.STRING },
                mid_scenes: { type: Type.STRING },
                final_scenes: { type: Type.STRING },
            }
        },
        lighting_preference: { type: Type.STRING },
        emotional_states: {
            type: Type.OBJECT,
            properties: {
                vulnerable: { type: Type.STRING },
                determined: { type: Type.STRING },
                authentic: { type: Type.STRING },
            }
        },
    }
};

const storyboardPanelPromptSchema = {
    type: Type.OBJECT,
    properties: {
        scene_title: { type: Type.STRING },
        description_es: { type: Type.STRING },
        description_en: { type: Type.STRING },
        dialogue_es: { type: Type.STRING },
        dialogue_en: { type: Type.STRING },
        camera_angle: { type: Type.STRING },
        lighting_specific: { type: Type.STRING },
        props: { type: Type.STRING },
        mood: { type: Type.STRING },
    }
};

const storyboardGroupPromptSchema = {
    type: Type.OBJECT,
    properties: {
        total_scenes: { type: Type.INTEGER },
        aspect_ratio: { type: Type.STRING },
        canvas_size: { type: Type.STRING },
        division_strategy: { type: Type.STRING },
        global_style: {
            type: Type.OBJECT,
            properties: {
                aesthetic: { type: Type.STRING },
                lighting: { type: Type.STRING },
                color_palette: { type: Type.STRING },
                consistency: { type: Type.STRING },
            }
        },
        individual_panels: { type: Type.OBJECT } // Simplified for validation
    }
};

const aiProductionGuideSchema = {
    type: Type.OBJECT,
    properties: {
        prompts: {
            type: Type.OBJECT,
            properties: {
                character_master_prompts: { type: Type.OBJECT }, // Simplified
                storyboard_groups: { type: Type.OBJECT }, // Simplified
                negative_prompts: {
                    type: Type.OBJECT,
                    properties: {
                        character_consistency: { type: Type.ARRAY, items: { type: Type.STRING } },
                        technical_quality: { type: Type.ARRAY, items: { type: Type.STRING } },
                        scene_specific: { type: Type.ARRAY, items: { type: Type.STRING } },
                    }
                },
                audio_generation_prompts: {
                    type: Type.OBJECT,
                    properties: {
                        opening_theme_es: { type: Type.STRING },
                        opening_theme_en: { type: Type.STRING },
                        marcus_theme_es: { type: Type.STRING },
                        marcus_theme_en: { type: Type.STRING },
                        community_theme_es: { type: Type.STRING },
                        community_theme_en: { type: Type.STRING },
                    }
                }
            }
        }
    }
};


const documentationDossierSchema = {
    type: Type.OBJECT,
    properties: {
        storyPlan: { ...storyPlanSchema, description: "The fully rewritten and improved story masterplan." },
        documentation: {
            type: Type.OBJECT,
            properties: {
                readme: { type: Type.STRING, description: "A master README.md file in Markdown format with a Table of Contents for the whole dossier." },
                aiProductionGuide: aiProductionGuideSchema,
                directorsBible: { type: Type.STRING, description: "Bilingual (ES/EN) master document covering the artistic, technical, and emotional vision." },
                visualStyleGuide: { type: Type.STRING, description: "Bilingual (ES/EN) guide for visual direction, color palettes, and cinematography." },
                narrativeStory: { type: Type.STRING, description: "Bilingual (ES/EN) full, literary-quality narrative story." },
                literaryScript: { type: Type.STRING, description: "Bilingual (ES/EN) professional, theatrical-style script." },
            },
             required: ['readme', 'aiProductionGuide', 'directorsBible', 'visualStyleGuide', 'narrativeStory', 'literaryScript']
        },
        hookMatrix: {
            type: Type.OBJECT,
            properties: {
                patternInterrupts: { type: Type.ARRAY, items: hookTemplateSchema },
                psychologicalTriggers: { type: Type.ARRAY, items: hookTemplateSchema },
                curiosityGaps: { type: Type.ARRAY, items: hookTemplateSchema },
                powerPhrases: { type: Type.ARRAY, items: hookTemplateSchema },
                provenStructures: { type: Type.ARRAY, items: hookTemplateSchema },
            },
            required: ['patternInterrupts', 'psychologicalTriggers', 'curiosityGaps', 'powerPhrases', 'provenStructures']
        }
    },
    required: ['storyPlan', 'documentation', 'hookMatrix']
};


// --- Prompt Generation Functions ---

export const getConceptAssistancePrompt = (idea: string) => ({
    contents: `Based on this initial idea, flesh it out into a more structured concept.
    Initial Idea: "${idea}"`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: conceptSchema,
    }
});

export const getStyleSuggestionPrompt = (concept: InitialConcept) => ({
    contents: `You are an expert AI director creating a complete Style and Format profile based on the provided concept.
    
**Your Task is to create a complete profile. Follow these steps precisely:**
1.  Analyze the user's concept provided below.
2.  For **EACH** of the 7 categories listed (Output Format, Narrative Style, Visual Style, Structure, Hook, Conflict, Ending), you **MUST** select between 1 and 3 of the most appropriate options from the available lists.
3.  Your selections **MUST** use the machine-readable value keys (e.g., 'tiktok_vertical', 'comedy', 'film_noir_look').
4.  For the \`energyLevel\`, provide a number from 1 to 10.
5.  For \`styleNotes\`, write a brief, creative summary that encapsulates the chosen styles.
6.  Ensure your final JSON response includes populated arrays for ALL 7 categories.

**Concept:**
${JSON.stringify(concept, null, 2)}

---
**AVAILABLE OPTIONS (CHOOSE FROM THESE):**
---

**1. Output Format (outputFormat):**
${formatOptionsForPrompt(outputFormats)}

**2. Narrative Style (narrativeStyle):**
${formatOptionsForPrompt(narrativeStyles)}

**3. Visual Style (visualStyle):**
${formatOptionsForPrompt(visualStyles)}

**4. Narrative Structure (narrativeStructure):**
${formatOptionsForPrompt(narrativeStructures)}

**5. Hook Type (hook):**
${formatOptionsForPrompt(hookTypes)}

**6. Conflict Type (conflict):**
${formatOptionsForPrompt(conflictTypes)}

**7. Ending Type (ending):**
${formatOptionsForPrompt(endingTypes)}
    `,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: styleSchema,
    }
});

export const getCharacterAssistancePrompt = (character: CharacterDefinition, concept: InitialConcept) => ({
    contents: `Flesh out the details for the following character within the context of this story concept.
    Story Concept: ${concept.idea}
    Character Details: ${JSON.stringify({ name: character.name, role: character.role, description: character.description })}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: characterSchema,
    }
});

export const getCharacterCastPrompt = (concept: InitialConcept) => ({
    contents: `Based on the following story concept, generate a compelling cast of 3-5 main characters.
    Story Concept: ${JSON.stringify(concept)}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: characterCastSchema,
    }
});

export const getStructureAssistancePrompt = (concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[]) => ({
    contents: `Based on the concept, style, and characters provided, write a summary for a classic three-act structure.
    Concept: ${JSON.stringify(concept)}
    Style: ${JSON.stringify(style)}
    Characters: ${JSON.stringify(characters.map(c => ({ name: c.name, role: c.role })))}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: structureSchema,
    }
});

export const getCoherenceCheckPrompt = (state: StoryBuilderState) => ({
    contents: `Analyze the following story elements for coherence, consistency, and potential plot holes.
    First, provide a series of progress updates as distinct JSON objects, one per line. Each object should have a "progress" key containing an array of step objects.
    Example of a progress update object:
    {"progress":[{"id":"1","label":"Analyzing Concept","status":"complete","result":"OK"}]}
    
    After all progress updates, provide the final, complete report as a single JSON object on a new line. The final object must match this structure:
    {"report":{"coherenceScore":NUMBER,"overallAssessment":"STRING","checks":[{"id":"STRING","element":"STRING","concern":"STRING","suggestion":"STRING","severity":"STRING"}]}}
    
    Story Data: ${JSON.stringify({
        concept: state.initialConcept,
        style: state.styleAndFormat,
        characters: state.characters,
        structure: state.storyStructure,
    })}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
    }
});

export const getApplyCoherenceSuggestionsPrompt = (state: StoryBuilderState, suggestionsToApply: StructuralCoherenceReport['checks']) => ({
    contents: `You are an expert script doctor. Your task is to rewrite parts of the provided story data based *only* on the selected suggestions.
    
    **CURRENT STORY DATA:**
    ${JSON.stringify({
        concept: state.initialConcept,
        style: state.styleAndFormat,
        characters: state.characters,
        structure: state.storyStructure,
    })}

    **SUGGESTIONS TO APPLY:**
    ${JSON.stringify(suggestionsToApply)}

    **INSTRUCTIONS:**
    1.  Carefully read each suggestion.
    2.  Modify the corresponding section in the story data to implement the suggestion.
    3.  Return a JSON object containing ONLY the modified sections. If you change a character, return the ENTIRE updated characters array. Do not include sections that were not changed.
    `,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: storyCorrectionSchema,
    }
});

export const getStoryPlanGenerationPrompt = (state: StoryBuilderState) => {
    const {
        initialConcept,
        styleAndFormat,
        characters,
        storyStructure
    } = state;

    const planInputs = {
        initialConcept,
        styleAndFormat,
        characters,
        storyStructure,
    };

    return {
        contents: `You are an AI director. Take all the provided information and synthesize it into a complete, detailed Story Masterplan. Break down the three acts into specific, numbered scenes with titles, summaries, emotional beats, and characters present. Generate a logline, title, and theme. Fill out all sections of the JSON object.
        Full Story Data: ${JSON.stringify(planInputs)}`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: storyPlanSchema,
        }
    };
};

export const getCritiquePrompt = (storyPlan: StoryMasterplan, refined: boolean = false, userSelections?: {strategies: Critique['improvementStrategies'], notes?: string}) => {
    const context = refined && userSelections ? `
This is a REFINEMENT round (Reporte β). The user has reviewed the initial critique and provided the following feedback.
- **Selected Strategies to Implement:** ${JSON.stringify(userSelections.strategies)}
- **Additional Director's Notes:** "${userSelections.notes || 'No additional notes.'}"

Your task is to generate a new, more focused critique that incorporates this feedback, potentially adjusting the viral score and offering more targeted improvement strategies.
` : `This is the initial analysis round (Reporte α). Provide a comprehensive first-pass critique. Assign a severity ('Minor', 'Moderate', or 'High') to each weakness identified. First, stream a series of progress updates as JSON objects, one per line, like {"progress": [{"id": "1", "label": "Analyzing Strengths", "status": "running"}]}. After all updates, provide the final, complete critique in the specified JSON format on a new line.`;

    const { critique, ...planToAnalyze } = storyPlan;

    return {
        contents: `Analyze this Story Masterplan. ${context}
        Story Plan: ${JSON.stringify(planToAnalyze)}`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_CRITIC,
        }
    };
};

export const getApplyCritiqueImprovementsPrompt = (storyPlan: StoryMasterplan, weaknessesToFix: Critique['weaknesses']) => ({
    contents: `You are an expert AI Script Doctor. Your task is to rewrite and improve the provided Story Masterplan to fix the specific weaknesses identified.

**CURRENT STORY MASTERPLAN:**
${JSON.stringify(storyPlan)}

**WEAKNESSES TO FIX:**
${JSON.stringify(weaknessesToFix)}

**INSTRUCTIONS:**
1.  Carefully analyze each weakness and its suggestion.
2.  Intelligently rewrite the relevant sections of the story masterplan (characters, story_structure, etc.) to address these points.
3.  Maintain the overall tone and intent of the original plan.
4.  Return the **complete, updated Story Masterplan** in the correct JSON format.
`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: storyPlanSchema,
    }
});


export const getViralitySuggestionsPrompt = (storyPlan: StoryMasterplan) => ({
    contents: `You are a Viral Content Analyst. Your sole focus is to generate new, creative strategies to increase the viral potential of the provided story plan.

**Story Plan:**
${JSON.stringify(storyPlan.metadata)}
${JSON.stringify(storyPlan.creative_brief)}

**Task:**
Generate a list of 3-5 highly specific and actionable "improvementStrategies" focused exclusively on making the content more shareable, engaging, and attention-grabbing for social media. Provide a unique \`id\`, a catchy \`title\`, and a clear \`description\` for each. Do not analyze strengths or weaknesses, only provide new viral strategies.`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_CRITIC,
        responseMimeType: 'application/json',
        responseSchema: improvementStrategiesSchema,
    }
});

export const getDocumentationDossierPrompt = (storyPlan: StoryMasterplan) => ({
    contents: `You are a professional production house team (like SIERRA or Hondo Studio). Your task is to generate a complete production dossier based on the approved story masterplan.

**Approved Story Masterplan:**
${JSON.stringify(storyPlan)}

**YOUR MISSION:**
1.  **Generate Professional Documentation:** Create the following production documents with the quality of a master like Nabokov or Borges. For each document, provide the content first in Spanish (ES), then an English (EN) translation. Art direction (lighting, color, camera) should be naturally embedded within the narrative and script.
    - \`readme\`: A master README.md file in Markdown, following the user's specified artistic structure.
    - \`narrativeStory\`: A full, literary-quality narrative or tale with integrated visual references.
    - \`literaryScript\`: A professional script with scenes, dialogue, and action, in proper screenplay format with embedded visual direction.
    - \`directorsBible\`, \`visualStyleGuide\`: Rich, detailed professional guides as per the user's specification.
2.  **Generate an AI Production Guide:** Create an \`aiProductionGuide\` object containing highly structured, detailed, bilingual JSON prompts for characters and scenes, exactly as specified in the schema and user examples. This is a technical document for the AI.
3.  **Create a Hook Matrix:** Generate 50 viral hooks for the story across the 5 specified categories.

**OUTPUT:**
Return a single JSON object containing the complete \`documentation\` object (including the structured \`aiProductionGuide\`), the \`hookMatrix\`, and the original \`storyPlan\` for reference.`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: documentationDossierSchema,
    }
});