/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Type } from '@google/genai';
import type { 
    InitialConcept, StyleAndFormat, CharacterDefinition, 
    // FIX: Import all necessary types.
    StoryStructure, StoryBuilderState, StoryMasterplan, Critique, StructuralCoherenceReport,
    AiProductionGuidePrompts,
    PremiumStoryPlan
} from '../components/story-builder/types';
import { STYLE_OPTIONS_COMPLETE } from '../utils/styleOptions';

// Define a type for the prompt request for better type safety
type PromptRequest = {
    contents: string;
    config: {
        systemInstruction: string;
        responseMimeType: 'application/json';
        responseSchema: any;
        temperature: number;
        maxOutputTokens?: number;
        candidateCount?: number;
    }
}

// --- System Instructions (Spanish Only) ---
export const SYSTEM_INSTRUCTION_DIRECTOR = `Eres un AI Director de Cine, Guionista y Productor Creativo experto. Tu objetivo es ayudar al usuario a construir una historia completa, coherente y convincente. Eres analítico, creativo y estructurado. SIEMPRE responde en ESPAÑOL únicamente. No generes contenido en inglés. Siempre debes responder en el formato JSON solicitado.`;
export const SYSTEM_INSTRUCTION_CRITIC = `Eres un AI Story Critic y Analista de Contenido Viral agudo, perspicaz, pero constructivo. Tu tarea es analizar un plan de historia e identificar sus fortalezas, debilidades y potencial de éxito viral. Proporcionas comentarios prácticos y específicos con ejemplos. SIEMPRE responde en ESPAÑOL únicamente. No generes contenido en inglés. Siempre debes responder en el formato JSON solicitado.`;


// --- JSON Schemas (Spanish Only, Gemini-Compatible) ---
const conceptSchema = {
    type: Type.OBJECT,
    properties: {
        idea: { 
            type: Type.STRING, 
            description: "Idea central refinada, específica y atractiva (100-300 caracteres)" 
        },
        targetAudience: { 
            type: Type.STRING, 
            description: "Descripción detallada del público objetivo ideal (demographics, intereses, comportamientos)" 
        },
        keyElements: { 
            type: Type.ARRAY, 
            items: { 
                type: Type.STRING,
                description: "Elemento específico que enriquece la historia"
            },
            description: "Exactamente 5-7 elementos clave (temas, visuales, conflictos, oportunidades)",
        },
        viabilityScore: {
            type: Type.NUMBER,
            description: "Puntuación de viabilidad de producción (1-10)",
        },
        suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 sugerencias específicas para desarrollar la idea",
        }
    },
    required: ['idea', 'targetAudience', 'keyElements', 'viabilityScore', 'suggestions']
};

const styleRecommendationSchema = {
    type: Type.OBJECT,
    properties: {
        recommendedFormats: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 formatos de salida más apropiados"
        },
        narrativeStyle: {
            type: Type.ARRAY,  
            items: { type: Type.STRING },
            description: "3-4 estilos narrativos recomendados"
        },
        visualStyle: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-4 estilos visuales apropiados"
        },
        suggestedStructure: {
            type: Type.STRING,
            description: "Estructura narrativa más efectiva para este concepto"
        },
        hookTypes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 tipos de gancho más efectivos"
        },
        reasoning: {
            type: Type.STRING,
            description: "Justificación de por qué estas elecciones funcionan juntas"
        }
    },
    required: ['recommendedFormats', 'narrativeStyle', 'visualStyle', 'suggestedStructure', 'hookTypes', 'reasoning']
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

export const premiumStoryPlanSchema = { /* unchanged */ };
export const storyPlanCorrectionSchema = { /* unchanged */ };
export const metricsOptimizationSuggestionsSchema = { /* unchanged */ };
export const premiumDocumentationSchema = { /* unchanged */ };


// --- Prompt Generation Functions ---

export const getConceptAssistancePrompt = (idea: string): PromptRequest => {
    const sanitizedIdea = idea.replace(/[<>{}]/g, '').substring(0, 500);
    
    return {
        contents: `Eres un asistente creativo experto especializado en desarrollo de historias.

**CONTEXTO:**
El usuario tiene una idea inicial que necesita refinamiento y desarrollo profesional.

**IDEA INICIAL:**
"${sanitizedIdea}"

**TAREAS ESPECÍFICAS:**
1. **REFINAMIENTO**: Convierte la idea en un concepto más específico, atractivo y comercialmente viable
2. **PÚBLICO OBJETIVO**: Identifica el público más probable (demografía, intereses, comportamientos)
3. **ELEMENTOS CLAVE**: Identifica 5-7 elementos que enriquezcan la historia:
   - Temas emocionales resonantes
   - Elementos visuales distintivos
   - Conflictos centrales potenciales
   - Oportunidades de engagement

**CRITERIOS DE CALIDAD:**
- Mantener la esencia original del usuario
- Agregar especificidad y concreción
- Enfocarse en potencial viral y conexión emocional
- Considerar viabilidad de producción

**FORMATO DE RESPUESTA:**
Responde ÚNICAMENTE en JSON válido con la estructura exacta solicitada.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: conceptSchema,
            temperature: 0.75,
            maxOutputTokens: 1024,
            candidateCount: 1
        }
    };
};

export const getStyleSuggestionPrompt = (concept: InitialConcept): PromptRequest => {
    // FIX: Correctly access properties on the `concept` object.
    const ideaSummary = concept.idea?.substring(0, 200) || 'Historia sin concepto definido';
    const audience = concept.targetAudience || 'Público general';
    const elements = concept.keyElements?.join(', ') || 'Sin elementos específicos';
    
    return {
        contents: `Eres un director creativo especializado en definir el estilo visual y narrativo óptimo para historias.

**CONCEPTO DE LA HISTORIA:**
${ideaSummary}

**PÚBLICO OBJETIVO:**
${audience}

**ELEMENTOS CLAVE:**
${elements}

**MISIÓN:**
Recomienda configuraciones específicas de estilo que maximicen el impacto y engagement de esta historia.

**ANÁLISIS REQUERIDO:**
1. **Formato de Salida**: ¿Qué formatos maximizan el potencial de esta historia? (video corto, series, interactivo, etc.)
2. **Estilo Narrativo**: ¿Qué géneros y tonos complementan mejor la historia?
3. **Estilo Visual**: ¿Qué estéticas visuales potencian la narrativa?
4. **Estructura**: ¿Qué estructuras narrativas optimizan el engagement?
5. **Ganchos**: ¿Qué tipos de hooks funcionan mejor para este concepto?

**CRITERIOS:**
- Alineación con público objetivo
- Viabilidad de producción
- Potencial viral y shareability
- Coherencia entre todas las elecciones de estilo

Responde en JSON con recomendaciones específicas y justificadas.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: styleRecommendationSchema,
            temperature: 0.7,
            maxOutputTokens: 1536
        }
    };
};

export const getStyleSelectionPrompt = (concept: InitialConcept) => {
    return {
        contents: `Eres un director creativo experto. Basándote en este concepto de historia, selecciona las opciones de estilo más apropiadas.

**CONCEPTO DE LA HISTORIA:**
- Idea: ${concept.idea}
- Público objetivo: ${concept.targetAudience || 'General'}
- Elementos clave: ${concept.keyElements?.join(', ') || 'No especificados'}

**INSTRUCCIONES ESPECÍFICAS:**
1. Selecciona EXACTAMENTE 3-4 opciones por categoría.
2. Elige opciones que se complementen entre sí para crear una visión coherente.
3. Prioriza la coherencia temática y visual.
4. Considera el público objetivo y la plataforma más probable.
5. Balancea entre opciones populares y creativas.

**OPCIONES DISPONIBLES (USA ESTOS TEXTOS EXACTOS):**
${JSON.stringify(STYLE_OPTIONS_COMPLETE, null, 2)}

**IMPORTANTE:**
- Responde SOLO con el JSON solicitado.
- Usa los textos EXACTOS de las opciones disponibles.
- No inventes opciones nuevas.
- Mantén coherencia entre todas las categorías seleccionadas.

Responde en formato JSON con la estructura solicitada.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: styleRecommendationSchema,
            temperature: 0.7,
            maxOutputTokens: 2048
        }
    };
};

export const getCharacterAssistancePrompt = (character: CharacterDefinition, concept: InitialConcept): PromptRequest => {
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

export const getCharacterCastPrompt = (concept: InitialConcept): PromptRequest => {
    return {
        contents: `Genera un elenco completo de personajes para esta historia.

**CONCEPTO:** ${concept.idea}
**PÚBLICO:** ${concept.targetAudience || 'General'}
**ELEMENTOS:** ${concept.keyElements?.join(', ') || 'No especificados'}

**REQUERIMIENTOS:**
1. **Protagonista Principal**: Personaje central con arco de transformación claro
2. **Personajes Secundarios**: 2-3 personajes que apoyen/desafíen al protagonista  
3. **Antagonista/Obstáculo**: Fuerza opositora (persona, sistema, o conflicto interno)

**PARA CADA PERSONAJE:**
- Nombre y edad apropiados
- Rol en la historia (protagonista, aliado, antagonista, etc.)
- Motivación central y miedos
- Descripción física básica
- Arco de transformación o función narrativa

Crea personajes que generen conexión emocional y dinamismo narrativo.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json', 
            responseSchema: characterCastSchema,
            temperature: 0.8
        }
    };
};

export const getStructureAssistancePrompt = (
    concept: InitialConcept, 
    style: StyleAndFormat, 
    characters: CharacterDefinition[]
): PromptRequest => {
    // FIX: Correctly access properties on the typed objects.
    const characterNames = characters.map(c => c.name).join(', ') || 'Sin personajes definidos';
    const narrativeStyles = style.narrativeStyle?.join(', ') || 'Estilo estándar';
    
    return {
        contents: `Crea una estructura narrativa sólida de 3 actos para esta historia.

**CONCEPTO:** ${concept.idea}
**PERSONAJES:** ${characterNames}
**ESTILO:** ${narrativeStyles}

**ESTRUCTURA DE 3 ACTOS REQUERIDA:**

**ACTO 1 - PLANTEAMIENTO (25%):**
- Mundo ordinario y presentación del protagonista
- Incidente incitante que desencadena la historia
- Primer punto de giro que lanza al acto 2

**ACTO 2 - CONFRONTACIÓN (50%):**
- Desarrollo del conflicto central
- Obstáculos progresivos y complicaciones
- Punto medio con revelación o cambio importante
- Crisis mayor que lleva al clímax

**ACTO 3 - RESOLUCIÓN (25%):**
- Clímax emocional y narrativo
- Resolución del conflicto
- Nuevo mundo/estado tras la transformación

Para cada acto, proporciona un resumen específico de 100-200 palabras que incluya eventos clave, desarrollo de personajes y progresión emocional.`,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_DIRECTOR,
            responseMimeType: 'application/json',
            responseSchema: structureSchema,
            temperature: 0.7
        }
    };
};


export const getPremiumStoryPlanPrompt = (state: StoryBuilderState) => ({ /* unchanged */ });

export const getPremiumDocumentationPrompt = (premiumStoryPlan: PremiumStoryPlan, docIds: string[]) => ({ /* unchanged */ });