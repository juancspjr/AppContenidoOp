/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Type } from '@google/genai';
import type { 
    InitialConcept, StyleAndFormat, CharacterDefinition, 
    StoryStructure, StoryBuilderState, StoryMasterplan, Critique, StructuralCoherenceReport,
    AiProductionGuidePrompts,
    PremiumStoryPlan
} from '../components/story-builder/types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from '../components/story-builder/constants';

// Helper to format options for the prompt
const formatOptionsForPrompt = (category: Record<string, any[]>) => {
    return Object.entries(category).map(([groupName, options]) => 
        `-- ${groupName} --\n` + options.map(opt => `* ${opt.value || opt.name} (${opt.description})`).join('\n')
    ).join('\n\n');
};

// --- System Instructions (Spanish Only) ---
export const SYSTEM_INSTRUCTION_DIRECTOR = `Eres un AI Director de Cine, Guionista y Productor Creativo experto. Tu objetivo es ayudar al usuario a construir una historia completa, coherente y convincente. Eres analítico, creativo y estructurado. SIEMPRE responde en ESPAÑOL únicamente. No generes contenido en inglés. Siempre debes responder en el formato JSON solicitado.`;
export const SYSTEM_INSTRUCTION_CRITIC = `Eres un AI Story Critic y Analista de Contenido Viral agudo, perspicaz, pero constructivo. Tu tarea es analizar un plan de historia e identificar sus fortalezas, debilidades y potencial de éxito viral. Proporcionas comentarios prácticos y específicos con ejemplos. SIEMPRE responde en ESPAÑOL únicamente. No generes contenido en inglés. Siempre debes responder en el formato JSON solicitado.`;
const SYSTEM_INSTRUCTION_ARTIST = `Eres un AI Concept Artist y Director de Fotografía de clase mundial. Traduces descripciones narrativas en prompts visuales ricos, detallados y evocadores para un modelo de generación de imágenes. Eres un experto en cinematografía, iluminación, composición y estilos artísticos. SIEMPRE responde en ESPAÑOL únicamente. No generes contenido en inglés.`;


// --- JSON Schemas (Spanish Only) ---
const conceptSchema = {
    type: Type.OBJECT,
    properties: {
        idea: { type: Type.STRING, description: "La idea central y refinada de la historia en una frase convincente." },
        targetAudience: { type: Type.STRING, description: "Una descripción más detallada del público objetivo." },
        keyElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Una lista de 5-7 elementos temáticos o visuales clave." },
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
        initialConcept: { ...conceptSchema, description: 'El concepto actualizado. Solo incluir si se cambió.' },
        styleAndFormat: { ...styleSchema, description: 'El estilo actualizado. Solo incluir si se cambió.' },
        characters: { type: Type.ARRAY, items: characterSchema, description: 'La lista de personajes actualizada. Devolver la lista completa y actualizada si se cambia algún personaje.'},
        storyStructure: { ...structureSchema, description: 'La estructura actualizada. Solo incluir si se cambió.' },
    },
};


const storyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        metadata: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "Un título creativo y pegadizo para la historia." },
                logline: { type: Type.STRING, description: "Un resumen de una frase de la historia (personaje + objetivo + conflicto)." },
                theme: { type: Type.STRING, description: "El tema o mensaje central de la historia." },
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
                    description: { type: Type.STRING, description: "Una breve descripción de la personalidad y antecedentes del personaje." },
                    visual_description: { type: Type.STRING, description: "Una descripción visual detallada para la generación de arte conceptual." },
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
                            title: { type: Type.STRING, description: "Un título para el acto, ej., 'El Planteamiento'." },
                            summary: { type: Type.STRING, description: "Un resumen de los eventos principales del acto." },
                            scenes: {
                                type: Type.ARRAY,
                                items: { // Scene
                                    type: Type.OBJECT,
                                    properties: {
                                        scene_number: { type: Type.INTEGER },
                                        title: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        emotional_beat: { type: Type.STRING, description: "El cambio o momento emocional clave en la escena." },
                                        characters_present: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        visual_elements_prompt: { type: Type.STRING, description: "Un prompt conciso que describe los elementos visuales clave para la generación de imágenes." },
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


export const premiumStoryPlanSchema = {
    ...storyPlanSchema,
    properties: {
        ...storyPlanSchema.properties,
        enhanced_metadata: {
            type: Type.OBJECT,
            properties: {
                psychological_profile: { type: Type.STRING },
                cultural_resonance: { type: Type.STRING },
                historical_significance: { type: Type.STRING },
                innovation_index: { type: Type.NUMBER },
                viral_potential: { type: Type.NUMBER },
                human_authenticity: { type: Type.NUMBER },
            }
        },
        agent_contributions: {
            type: Type.OBJECT,
            properties: {
                psychology_insights: { type: Type.ARRAY, items: { type: Type.STRING } },
                cultural_integrations: { type: Type.ARRAY, items: { type: Type.STRING } },
                historical_connections: { type: Type.ARRAY, items: { type: Type.STRING } },
                narrative_innovations: { type: Type.ARRAY, items: { type: Type.STRING } },
                viral_optimizations: { type: Type.ARRAY, items: { type: Type.STRING } },
            }
        }
    }
};

export const storyPlanCorrectionSchema = premiumStoryPlanSchema;


const critiqueSchema = {
    type: Type.OBJECT,
    properties: {
        narrative_score: { type: Type.NUMBER, description: "Puntuación de calidad narrativa (0-100)." },
        viral_score: { type: Type.NUMBER, description: "Puntuación de potencial viral (0-100)." },
        integrated_score: { type: Type.NUMBER, description: "Puntuación media ponderada." },
        strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Una lista de las fortalezas clave de la narrativa."
        },
        weaknesses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    point: { type: Type.STRING, description: "La debilidad identificada." },
                    suggestion: { type: Type.STRING, description: "Una sugerencia concreta para mejorar." },
                    severity: { type: Type.STRING, description: "Severidad de la debilidad: 'Minor', 'Moderate', o 'High'." },
                },
                required: ['point', 'suggestion', 'severity']
            },
            description: "Una lista de debilidades y sus correspondientes sugerencias."
        },
        viral_moments: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Momentos específicos en la historia con alto potencial viral."
        },
        improvement_strategies: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Un ID único para la estrategia, ej., 'enhance_character_motivation'." },
                    title: { type: Type.STRING, description: "El título de la estrategia de mejora." },
                    description: { type: Type.STRING, description: "Una descripción detallada de la estrategia." },
                },
                required: ['id', 'title', 'description']
            },
            description: "Una lista de estrategias de alto nivel para mejorar la historia."
        },
    },
    required: ['narrative_score', 'viral_score', 'integrated_score', 'strengths', 'weaknesses', 'viral_moments', 'improvement_strategies']
};


const improvementStrategiesSchema = {
    type: Type.OBJECT,
    properties: {
        improvementStrategies: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Un ID único para la estrategia, ej., 'add_viral_hook'." },
                    title: { type: Type.STRING, description: "El título de la estrategia de mejora." },
                    description: { type: Type.STRING, description: "Una descripción detallada de la estrategia." },
                },
                required: ['id', 'title', 'description']
            },
        }
    },
    required: ['improvementStrategies']
};

const characterMasterPromptSchema = {
    type: Type.OBJECT,
    properties: {
        base_description: { type: Type.STRING },
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
        description: { type: Type.STRING },
        dialogue: { type: Type.STRING },
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
                        opening_theme: { type: Type.STRING },
                        marcus_theme: { type: Type.STRING },
                        community_theme: { type: Type.STRING },
                    }
                }
            }
        }
    }
};


const enhancedDocumentationDossierSchema = {
    type: Type.OBJECT,
    properties: {
        storyPlan: { ...storyPlanSchema, description: "El plan maestro de la historia, completamente reescrito y mejorado." },
        documentation: {
            type: Type.OBJECT,
            properties: {
                readme: { type: Type.STRING, description: "Un archivo README.md maestro en formato Markdown con una Tabla de Contenidos para todo el dossier." },
                aiProductionGuide: aiProductionGuideSchema,
                directorsBible: { type: Type.STRING, description: "Documento maestro que cubre la visión artística, técnica y emocional." },
                visualStyleGuide: { type: Type.STRING, description: "Guía para la dirección visual, paletas de colores y cinematografía." },
                narrativeStory: { type: Type.STRING, description: "Historia narrativa completa, de calidad literaria." },
                literaryScript: { type: Type.STRING, description: "Guion profesional de estilo teatral." },
            },
             required: ['readme', 'aiProductionGuide', 'directorsBible', 'visualStyleGuide', 'narrativeStory', 'literaryScript']
        },
    },
    required: ['storyPlan', 'documentation']
};

const premiumDocumentationSchema_OLD = {
    ...enhancedDocumentationDossierSchema,
    properties: {
        ...enhancedDocumentationDossierSchema.properties,
        enhanced_components: {
            type: Type.OBJECT,
            properties: {
                psychological_analysis: { type: Type.STRING },
                cultural_study: { type: Type.STRING },
                historical_research: { type: Type.STRING },
                innovation_documentation: { type: Type.STRING },
                viral_strategy: { type: Type.STRING },
                humanization_report: { type: Type.STRING },
            }
        },
        quality_certifications: {
            type: Type.OBJECT,
            properties: {
                human_likeness_score: { type: Type.NUMBER },
                viral_potential_score: { type: Type.NUMBER },
                cultural_authenticity_score: { type: Type.NUMBER },
                innovation_uniqueness_score: { type: Type.NUMBER },
            }
        }
    }
};

export const metricsOptimizationSuggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        projected_viral: { type: Type.NUMBER, description: "La puntuación viral proyectada después de las mejoras (7-9.5)." },
        projected_authenticity: { type: Type.NUMBER, description: "El porcentaje de autenticidad proyectado (85-98)." },
        improvements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "Un ID único para la mejora, ej., 'enhance_opening_hook'." },
                    title: { type: Type.STRING, description: "Un título corto y descriptivo para la mejora." },
                    description: { type: Type.STRING, description: "Una explicación clara de qué cambiar y por qué mejorará las métricas." },
                    impact_points: { type: Type.NUMBER, description: "El impacto estimado de esta mejora en la puntuación general." },
                    category: { type: Type.STRING, description: "La categoría de la mejora ('viral' o 'authenticity')." }
                },
                required: ['id', 'title', 'description', 'impact_points', 'category']
            }
        }
    },
    required: ['projected_viral', 'projected_authenticity', 'improvements']
};



// --- Prompt Generation Functions ---

export const getConceptAssistancePrompt = (idea: string) => ({
    contents: `Basado en esta idea inicial, desarróllala hasta convertirla en un concepto más estructurado.
    Idea Inicial: "${idea}"`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: conceptSchema,
    }
});

export const getStyleSuggestionPrompt = (concept: InitialConcept) => ({
    contents: `Eres un director de IA experto creando un perfil completo de Estilo y Formato basado en el concepto proporcionado.
    
**Tu Tarea es crear un perfil completo. Sigue estos pasos con precisión:**
1.  Analiza el concepto del usuario proporcionado a continuación.
2.  Para **CADA** una de las 7 categorías listadas (Formato de Salida, Estilo Narrativo, Estilo Visual, Estructura, Gancho, Conflicto, Final), **DEBES** seleccionar entre 1 y 3 de las opciones más apropiadas de las listas disponibles.
3.  Tus selecciones **DEBEN** usar las claves de valor legibles por máquina (ej., 'tiktok_vertical', 'comedy', 'film_noir_look').
4.  Para el \`energyLevel\`, proporciona un número del 1 al 10.
5.  Para \`styleNotes\`, escribe un resumen breve y creativo que encapsule los estilos elegidos.
6.  Asegúrate de que tu respuesta JSON final incluya arrays poblados para TODAS las 7 categorías.
7.  **TODO EN ESPAÑOL.**

**Concepto:**
${JSON.stringify(concept, null, 2)}

---
**OPCIONES DISPONIBLES (ELIGE DE ESTAS):**
---

**1. Formato de Salida (outputFormat):**
${formatOptionsForPrompt(outputFormats)}

**2. Estilo Narrativo (narrativeStyle):**
${formatOptionsForPrompt(narrativeStyles)}

**3. Estilo Visual (visualStyle):**
${formatOptionsForPrompt(visualStyles)}

**4. Estructura Narrativa (narrativeStructure):**
${formatOptionsForPrompt(narrativeStructures)}

**5. Tipo de Gancho (hook):**
${formatOptionsForPrompt(hookTypes)}

**6. Tipo de Conflicto (conflict):**
${formatOptionsForPrompt(conflictTypes)}

**7. Tipo de Final (ending):**
${formatOptionsForPrompt(endingTypes)}
    `,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: styleSchema,
    }
});

export const getCharacterAssistancePrompt = (character: CharacterDefinition, concept: InitialConcept) => ({
    contents: `Desarrolla los detalles para el siguiente personaje dentro del contexto de este concepto de historia.
    Concepto de la Historia: ${concept.idea}
    Detalles del Personaje: ${JSON.stringify({ name: character.name, role: character.role, description: character.description })}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: characterSchema,
    }
});

export const getCharacterCastPrompt = (concept: InitialConcept) => ({
    contents: `Basado en el siguiente concepto de historia, genera un elenco convincente de 3-5 personajes principales.
    Concepto de la Historia: ${JSON.stringify(concept)}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: characterCastSchema,
    }
});

export const getStructureAssistancePrompt = (concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[]) => ({
    contents: `Basado en el concepto, estilo y personajes proporcionados, escribe un resumen para una estructura clásica de tres actos.
    Concepto: ${JSON.stringify(concept)}
    Estilo: ${JSON.stringify(style)}
    Personajes: ${JSON.stringify(characters.map(c => ({ name: c.name, role: c.role })))}`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: structureSchema,
    }
});

export const getCoherenceCheckPrompt = (state: StoryBuilderState) => ({
    contents: `Analiza los siguientes elementos de la historia en busca de coherencia, consistencia y posibles agujeros en la trama.
    Primero, proporciona una serie de actualizaciones de progreso como objetos JSON distintos, uno por línea. Cada objeto debe tener una clave "progress" que contenga un array de objetos de paso.
    Ejemplo de un objeto de actualización de progreso:
    {"progress":[{"id":"1","label":"Analizando Concepto","status":"complete","result":"OK"}]}
    
    Después de todas las actualizaciones de progreso, proporciona el informe final y completo como un único objeto JSON en una nueva línea. El objeto final debe coincidir con esta estructura:
    {"report":{"coherenceScore":NUMBER,"overallAssessment":"STRING","checks":[{"id":"STRING","element":"STRING","concern":"STRING","suggestion":"STRING","severity":"STRING"}]}}
    
    Datos de la Historia: ${JSON.stringify({
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
    contents: `Eres un doctor de guiones experto. Tu tarea es reescribir partes de los datos de la historia proporcionados basándote *únicamente* en las sugerencias seleccionadas.
    
    **DATOS ACTUALES DE LA HISTORIA:**
    ${JSON.stringify({
        concept: state.initialConcept,
        style: state.styleAndFormat,
        characters: state.characters,
        structure: state.storyStructure,
    })}

    **SUGERENCIAS A APLICAR:**
    ${JSON.stringify(suggestionsToApply)}

    **INSTRUCCIONES:**
    1.  Lee atentamente cada sugerencia.
    2.  Modifica la sección correspondiente en los datos de la historia para implementar la sugerencia.
    3.  Devuelve un objeto JSON que contenga ÚNICAMENTE las secciones modificadas. Si cambias un personaje, devuelve el array COMPLETO y actualizado de personajes. No incluyas secciones que no se cambiaron.
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
        contents: `Eres un director de IA. Toma toda la información proporcionada y sintetízala en un Plan Maestro de Historia completo y detallado. Desglosa los tres actos en escenas específicas y numeradas con títulos, resúmenes, puntos emocionales y personajes presentes. Genera un logline, título y tema. Completa todas las secciones del objeto JSON.
        Datos Completos de la Historia: ${JSON.stringify(planInputs)}`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: storyPlanSchema,
        }
    };
};

export const getPremiumStoryPlanPrompt = (state: StoryBuilderState) => {
    return {
        contents: `Eres un director de IA creando un Plan Maestro de Historia Premium. Se te ha dado una estructura de historia que ha sido mejorada por un equipo de agentes especializados. Tu tarea es sintetizar estos datos ricos y multicapa en un plan maestro coherente y convincente.

**DATOS DE HISTORIA MEJORADOS (ENTRADA):**
${JSON.stringify({
    initialConcept: state.initialConcept,
    styleAndFormat: state.styleAndFormat,
    characters: state.characters,
    enhancedData: state.enhancedData,
}, null, 2)}

**MISIÓN:**
1.  **Sintetiza, no solo copies:** Integra las mejoras de los agentes (psicología, cultura, etc.) de forma natural en los resúmenes de las escenas, las descripciones de los personajes y el tema general.
2.  **Crea el Plan Maestro Base:** Genera todos los campos estándar de un \`StoryMasterplan\` (metadata, creative_brief, characters, story_structure).
3.  **Puebla los Metadatos Mejorados:** Basándote en los datos de los agentes, crea las secciones \`enhanced_metadata\` y \`agent_contributions\` del \`PremiumStoryPlan\`. Resume los conocimientos y cuantifica el potencial.
4.  **Asegura la Coherencia:** El plan final debe sentirse como una visión única y unificada, no como una colección de resultados de agentes separados.
5.  **TODO EN ESPAÑOL.**
`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: premiumStoryPlanSchema,
        }
    };
};

export const getCritiquePrompt = (storyPlan: StoryMasterplan, refined: boolean = false, userSelections?: {strategies: Critique['improvement_strategies'], notes?: string}) => {
    const context = refined && userSelections ? `
Esta es una ronda de REFINAMIENTO (Reporte β). El usuario ha revisado la crítica inicial y ha proporcionado la siguiente retroalimentación.
- **Estrategias Seleccionadas para Implementar:** ${JSON.stringify(userSelections.strategies)}
- **Notas Adicionales del Director:** "${userSelections.notes || 'Sin notas adicionales.'}"

Tu tarea es generar una nueva crítica, más enfocada, que incorpore esta retroalimentación, ajustando potencialmente la puntuación viral y ofreciendo estrategias de mejora más específicas.
` : `
EVALUACIÓN INTEGRAL: NARRATIVA + VIRAL FUSIONADA

CRITERIOS DE EVALUACIÓN BALANCEADOS:
1. NARRATIVA (60% peso):
   - Coherencia estructural
   - Desarrollo de personajes  
   - Arco emocional
   - Calidad artística
   
2. VIRAL (40% peso):
   - Potencial de engagement
   - Ganchos naturales en la historia
   - Shareability por plataforma
   - Momentos virales identificados

GENERA EVALUACIÓN ÚNICA QUE BALANCEA AMBOS ASPECTOS.
La historia debe ser artísticamente sólida Y viralmente optimizada.
Primero, transmite una serie de actualizaciones de progreso como objetos JSON, uno por línea, como {"progress": [{"id": "1", "label": "Analizando Fortalezas", "status": "running"}]}. Después de todas las actualizaciones, proporciona la crítica final y completa en el formato JSON especificado en una nueva línea.
`;

    const { critique, ...planToAnalyze } = storyPlan;

    return {
        contents: `Analiza este Plan Maestro de Historia. ${context}
        Plan de Historia: ${JSON.stringify(planToAnalyze)}`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_CRITIC,
        }
    };
};

export const getApplyCritiqueImprovementsPrompt = (storyPlan: StoryMasterplan, weaknessesToFix: Critique['weaknesses']) => ({
    contents: `Eres un Doctor de Guiones de IA experto. Tu tarea es reescribir y mejorar el Plan Maestro de Historia proporcionado para corregir las debilidades específicas identificadas.

**PLAN MAESTRO DE HISTORIA ACTUAL:**
${JSON.stringify(storyPlan)}

**DEBILIDADES A CORREGIR:**
${JSON.stringify(weaknessesToFix)}

**INSTRUCCIONES:**
1.  Analiza cuidadosamente cada debilidad y su sugerencia.
2.  Reescribe inteligentemente las secciones relevantes del plan maestro de la historia (personajes, story_structure, etc.) para abordar estos puntos.
3.  Mantén el tono y la intención general del plan original.
4.  Devuelve el **Plan Maestro de Historia completo y actualizado** en el formato JSON correcto.
`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
        responseMimeType: 'application/json',
        responseSchema: storyPlanSchema,
    }
});


export const getViralitySuggestionsPrompt = (storyPlan: StoryMasterplan) => ({
    contents: `Eres un Analista de Contenido Viral. Tu único enfoque es generar estrategias nuevas y creativas para aumentar el potencial viral del plan de historia proporcionado.

**Plan de Historia:**
${JSON.stringify(storyPlan.metadata)}
${JSON.stringify(storyPlan.creative_brief)}

**Tarea:**
Genera una lista de 3-5 "improvementStrategies" altamente específicas y accionables, enfocadas exclusivamente en hacer el contenido más compartible, atractivo y que capte la atención para las redes sociales. Proporciona un \`id\` único, un \`title\` pegadizo y una \`description\` clara para cada una. No analices fortalezas o debilidades, solo proporciona nuevas estrategias virales.`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION_CRITIC,
        responseMimeType: 'application/json',
        responseSchema: improvementStrategiesSchema,
    }
});

export const getDocumentationDossierPrompt = (storyPlan: StoryMasterplan) => ({
  contents: `Eres un equipo de una casa productora profesional (como SIERRA o Hondo Studio). Tu tarea es generar un dossier de producción completo basado en el plan maestro de historia aprobado.

**CRÍTICO**: Esta documentación debe integrar la OPTIMIZACIÓN VIRAL en todos los documentos.

**Plan Maestro de Historia Aprobado:**
${JSON.stringify(storyPlan)}

**TU MISIÓN:**
1. **Genera Documentación Profesional con Viralidad Integrada:** Crea los siguientes documentos de producción con una calidad maestra, pero OPTIMIZADOS para potencial viral. Cada documento debe considerar elementos virales integrados de forma natural, no como una ocurrencia tardía.

   - \`readme\`: README.md maestro que incluye una visión general de la estrategia viral.
   - \`narrativeStory\`: Narrativa literaria con momentos y ganchos virales incrustados.
   - \`literaryScript\`: Guion profesional con puntos de tiempo y engagement viral marcados.
   - \`directorsBible\`: Biblia del director que incluye dirección viral y optimización de plataforma.
   - \`visualStyleGuide\`: Guía visual optimizada para diferentes plataformas (TikTok, YouTube, Instagram).

2. **Genera Guía de Producción de IA con Prompts Virales:** Crea prompts estructurados que generen contenido visualmente consistente Y viralmente optimizado.

3. **TODO EN ESPAÑOL.**

**SALIDA:**
Devuelve un objeto de documentación completo con optimización viral integrada.`,
  
  config: {
    systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
    responseMimeType: 'application/json',
    responseSchema: enhancedDocumentationDossierSchema,
  }
});

export const getPremiumDocumentationPrompt = (cleanStoryPlan: any) => {
    const promptContent = `Eres un equipo de producción premium. Genera documentación profesional para esta historia:

**PROYECTO:** ${cleanStoryPlan.metadata.title}
**LOGLINE:** ${cleanStoryPlan.metadata.logline}
**TEMA:** ${cleanStoryPlan.metadata.theme}

**PERSONAJES:**
${cleanStoryPlan.characters.map((char: any) => `- ${char.name}: ${char.description}`).join('\n')}

**ESTRUCTURA:**
${cleanStoryPlan.story_structure.narrative_arc.map((act: any) => `${act.title}: ${act.summary}`).join('\n')}

GENERA:
1. **README_MASTER.md**: Resumen ejecutivo del proyecto, incluyendo propósito, público objetivo y estrategia de contenido. Debe ser conciso y profesional.
2. **AI_PRODUCTION_GUIDE.json**: Prompts estructurados para generación de assets. Crea prompts detallados para al menos 2 personajes principales y 3 escenas clave.

IMPORTANTE: Responde SOLO con JSON válido. No incluyas markdown extra ni texto introductorio. Tu respuesta debe empezar con { y terminar con }.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            readme_content: {
                type: Type.STRING,
                description: "Contenido completo en formato Markdown para el archivo README.md del proyecto."
            },
            production_guide: {
                type: Type.OBJECT,
                properties: {
                    character_prompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Una lista de prompts detallados y listos para usar para generar imágenes de los personajes principales."
                    },
                    scene_prompts: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Una lista de prompts detallados y listos para usar para generar imágenes de las escenas clave."
                    }
                },
                required: ['character_prompts', 'scene_prompts']
            }
        },
        required: ['readme_content', 'production_guide']
    };

    return {
        contents: promptContent,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.7,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 4096 }
        }
    };
};