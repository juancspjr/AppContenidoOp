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
                audio_generation_prompts: { type: Type.OBJECT }
            }
        }
    }
};

const documentationBaseSchema = {
    type: Type.OBJECT,
    properties: {
        readme: { type: Type.STRING, description: "Un archivo README.md maestro en formato Markdown con una Tabla de Contenidos para todo el dossier." },
        aiProductionGuide: aiProductionGuideSchema,
        directorsBible: { type: Type.STRING, description: "Documento maestro que cubre la visión artística, técnica y emocional." },
        visualStyleGuide: { type: Type.STRING, description: "Guía para la dirección visual, paletas de colores y cinematografía." },
        narrativeStory: { type: Type.STRING, description: "Historia narrativa completa, de calidad literaria." },
        literaryScript: { type: Type.STRING, description: "Guion profesional de estilo teatral." },
    }
};


const premiumDocumentationSchema = {
    type: Type.OBJECT,
    properties: {
         ...documentationBaseSchema.properties,
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
                    impact_points: { type: Type.NUMBER, description: "El impacto estimado de esta mejora en la puntuatoria general." },
                    category: { type: Type.STRING, description: "La categoría de la mejora ('viral' o 'authenticity')." }
                },
                required: ['id', 'title', 'description', 'impact_points', 'category']
            }
        }
    },
    required: ['projected_viral', 'projected_authenticity', 'improvements']
};



// --- Prompt Generation Functions ---
export const getConceptAssistancePrompt = (idea: string) => {
    return {
        contents: `Eres un asistente de desarrollo creativo experto. Te doy una idea inicial y necesitas ayudarme a refinarla y completarla.

**IDEA INICIAL DEL USUARIO:**
"${idea}"

**TU MISIÓN:**
1. **Refina la idea** haciéndola más específica y atractiva.
2. **Identifica el público objetivo** más probable para esta historia.
3. **Sugiere 5-7 elementos clave** (temas, visuales, emociones) que podrían enriquecer la historia.

**IMPORTANTE:**
- Mantén la esencia original de la idea del usuario.
- Hazla más concreta y visual.
- Piensa en elementos que generen conexión emocional.
- Todo en español.

Responde en el formato JSON solicitado.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: conceptSchema,
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };
};

export const getStyleSuggestionPrompt = (concept: InitialConcept) => {
    return {
        contents: `Basándote en este concepto de historia, sugiere estilos y formatos apropiados.

**CONCEPTO:**
- Idea: ${concept.idea}
- Público: ${concept.targetAudience || 'General'}
- Elementos clave: ${concept.keyElements?.join(', ') || 'No especificados'}

Sugiere configuraciones de estilo que complementen esta historia. Selecciona varias opciones de cada categoría que creas que encajan bien. Todo en español.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: styleSchema,
            temperature: 0.7
        }
    };
};

export const getCharacterAssistancePrompt = (character: CharacterDefinition, concept: InitialConcept) => {
    return {
        contents: `Ayuda a desarrollar este personaje para la historia.

**CONCEPTO DE HISTORIA:** ${concept.idea}

**PERSONAJE ACTUAL:**
- Nombre: ${character.name || 'Sin nombre'}
- Descripción: ${character.description || 'Sin descripción'}
- Rol: ${character.role}

**TU MISIÓN:**
1.  Expande la **descripción** con más personalidad y antecedentes.
2.  Define su **motivación** (deseo, miedo, necesidad).
3.  Crea un **defecto crítico** interesante.
4.  Sugiere un **arco de personaje** (cómo cambia a lo largo de la historia).
5.  Proporciona **detalles visuales para la IA** (ej. 'pelo rojo, cicatriz en el ojo, ropa de cuero desgastada').

Mejora y profundiza este personaje. Todo en español.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: characterSchema,
            temperature: 0.8
        }
    };
};

export const getCharacterCastPrompt = (concept: InitialConcept) => {
    return {
        contents: `Genera un elenco completo de personajes para esta historia.

**CONCEPTO:** ${concept.idea}
**PÚBLICO:** ${concept.targetAudience || 'General'}

Crea 3-5 personajes principales y secundarios con roles claros (protagonista, antagonista, mentor, etc.), descripciones concisas y motivaciones. Todo en español.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: characterCastSchema,
            temperature: 0.8
        }
    };
};

export const getStructureAssistancePrompt = (concept: InitialConcept, style: StyleAndFormat, characters: CharacterDefinition[]) => {
    return {
        contents: `Crea una estructura narrativa de tres actos para esta historia.

**CONCEPTO:** ${concept.idea}
**ESTILO:** ${style.narrativeStyle?.join(', ') || 'Estándar'}
**PERSONAJES:** ${characters.map(c => c.name).join(', ')}

Desarrolla un resumen para cada uno de los tres actos (Planteamiento, Confrontación, Resolución) que sea coherente con los datos proporcionados. Todo en español.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: structureSchema,
            temperature: 0.7
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

// MODIFIED to accept a list of document IDs to generate
export const getPremiumDocumentationPrompt = (premiumStoryPlan: PremiumStoryPlan, docIds: string[]) => {
// FIX: The `reduce` accumulator `acc` is typed as `any` to allow for dynamic property creation (like `enhanced_components`), resolving a TypeScript error.
    const requestedSchemaProperties = docIds.reduce((acc: any, id: string) => {
        if ((premiumDocumentationSchema.properties as any)[id]) {
            acc[id] = (premiumDocumentationSchema.properties as any)[id];
        } else if ((premiumDocumentationSchema.properties.enhanced_components.properties as any)[id]) {
            if (!acc.enhanced_components) {
                acc.enhanced_components = { type: Type.OBJECT, properties: {} };
            }
            acc.enhanced_components.properties[id] = (premiumDocumentationSchema.properties.enhanced_components.properties as any)[id];
        }
        return acc;
    }, {});

    const dynamicSchema = {
        type: Type.OBJECT,
        properties: requestedSchemaProperties,
        required: docIds
    };

    return {
        contents: `Eres el equipo de la casa productora creativa más prestigiosa del mundo. Crea los siguientes componentes de documentación basados en el Plan de Historia Premium.

**PLAN DE HISTORIA PREMIUM:**
${JSON.stringify(premiumStoryPlan, null, 2)}

**DOCUMENTOS SOLICITADOS:**
${docIds.join(', ')}

**MISIÓN: Crear documentación que sea:**
1. **Psicológicamente Rica**: Incorpora todas las ideas y patrones psicológicos.
2. **Culturalmente Profunda**: Integra elementos culturales y profundidad antropológica.
3. **Históricamente Resonante**: Entrelaza referencias históricas y conexiones arquetípicas.
4. **Narrativamente Innovadora**: Muestra elementos disruptivos y únicos.
5. **Viralmente Optimizada**: Integra de forma natural ganchos virales y estrategias de retención.
6. **Completamente Humana**: Sin rastros de IA detectables, creatividad humana auténtica.

**CRÍTICO**: La documentación debe leerse como si hubiera sido creada por un equipo de expertos humanos. Sin mención de agentes de IA o mejoras artificiales. **TODO EN ESPAÑOL.**`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: dynamicSchema,
        }
    };
};