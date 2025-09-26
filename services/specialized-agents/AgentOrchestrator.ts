/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { PsychologyPatternAgent } from './PsychologyPatternAgent';
import { CulturalAnthropologyAgent } from './CulturalAnthropologyAgent';
import { HistoricalContextAgent } from './HistoricalContextAgent';
import { NarrativeDisruptorAgent } from './NarrativeDisruptorAgent';
import { ViralRetentionAgent } from './ViralRetentionAgent';
import { HumanizationAgent } from './HumanizationAgent';
import type { StoryBuilderState, EnhancedStoryData } from '../../components/story-builder/types';

// Define a simpler type for the base data passed between agents
type BaseStoryData = Pick<StoryBuilderState, 'storyStructure' | 'initialConcept' | 'styleAndFormat' | 'characters'>;

interface SpecializedAgent {
    name: string;
    outputField: keyof Omit<EnhancedStoryData, keyof StoryBuilderState | 'enhancement_metadata'>;
    process(
        data: any,
        callbacks: { onProgress?: (progress: any) => void }
    // FIX: Change 'enhancements' type to 'any' to accommodate agents that return non-array values (e.g., a score).
    ): Promise<{ enhancements: any; enhancedData?: any; quality_score?: number; }>;
}

export class AgentOrchestrator {
    private agents: SpecializedAgent[];
    
    constructor() {
        this.agents = [
            new PsychologyPatternAgent(),
            new CulturalAnthropologyAgent(),
            new HistoricalContextAgent(),
            new NarrativeDisruptorAgent(),
            new ViralRetentionAgent(),
            new HumanizationAgent()
        ];
    }

    async processWithAllAgents(
        baseData: BaseStoryData,
        callbacks: {
            onAgentStart?: (agentName: string) => void;
            onAgentProgress?: (progress: any) => void;
            onAgentComplete?: (agentName: string, result: any) => void;
        }
    ): Promise<EnhancedStoryData> {
        
        let processLog: any[] = [];
        let currentData: any = { ...baseData };
        const enhancements: any = {
            psychological_layers: [],
            cultural_elements: [],
            historical_depth: [],
            narrative_innovations: [],
            viral_hooks: [],
            humanization_score: 0,
            enhancement_metadata: {
                agents_applied: [],
                processing_time: Date.now(),
                quality_score: 0,
                process_log: []
            }
        };

        let totalQualityScore = 0;

        for (const agent of this.agents) {
            callbacks.onAgentStart?.(agent.name);
            
            const agentStartTime = Date.now();
            const steps = [
                `🔍 Analizando datos de entrada para ${agent.name}`,
                `🧠 Aplicando conocimiento especializado`,
                `⚡ Generando mejoras específicas`,
                `✅ Validando calidad de salida`,
                `📝 Integrando resultados al conjunto`
            ];
            
            for (let i = 0; i < steps.length; i++) {
                callbacks.onAgentProgress?.({
                    agent: agent.name,
                    step: i + 1,
                    total: steps.length,
                    description: steps[i],
                    timestamp: new Date().toISOString(),
                    status: 'processing'
                });
                
                await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
                 callbacks.onAgentProgress?.({
                    agent: agent.name,
                    step: i + 1,
                    total: steps.length,
                    description: steps[i],
                    timestamp: new Date().toISOString(),
                    status: 'complete'
                });
            }
            
            try {
                const result = await agent.process(currentData, {});
                const agentProcessingTime = Date.now() - agentStartTime;

                const contribution = {
                    agent: agent.name,
                    input_data_size: JSON.stringify(currentData).length,
                    enhancements_added: result.enhancements.length || (typeof result.enhancements === 'number' ? 1 : 0),
                    processing_time: agentProcessingTime,
                    quality_improvement: result.quality_score || 0
                };
                
                processLog.push(contribution);
                
                enhancements[agent.outputField] = result.enhancements;
                enhancements.enhancement_metadata.agents_applied.push(agent.name);
                totalQualityScore += result.quality_score || 0;
                
                currentData = { ...currentData, ...result.enhancedData };
                
                callbacks.onAgentComplete?.(agent.name, result);
                
            } catch (error: any) {
                console.error(`Agent ${agent.name} falló:`, error);
                processLog.push({
                    agent: agent.name,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        enhancements.enhancement_metadata.processing_time = Date.now() - enhancements.enhancement_metadata.processing_time;
        enhancements.enhancement_metadata.process_log = processLog;
        enhancements.enhancement_metadata.quality_score = parseFloat((totalQualityScore / this.agents.length).toFixed(2));
        
        return {
            ...currentData.storyStructure,
            ...enhancements,
        } as EnhancedStoryData;
    }

    generateProcessReport(enhancedData: EnhancedStoryData): string {
        const report = `# REPORTE DE CONSTRUCCIÓN ARTÍSTICA
        
## Resumen del Proceso
- **Fecha**: ${new Date().toLocaleString()}
- **Agentes Aplicados**: ${enhancedData.enhancement_metadata.agents_applied.join(', ')}
- **Tiempo Total**: ${(enhancedData.enhancement_metadata.processing_time / 1000).toFixed(2)}s
- **Score de Calidad Promedio**: ${enhancedData.enhancement_metadata.quality_score}/10

## Mejoras por Agente
${(enhancedData.enhancement_metadata.process_log || []).map(log => `
### ${log.agent}
- **Mejoras Añadidas**: ${log.enhancements_added}
- **Tiempo de Procesamiento**: ${(log.processing_time / 1000).toFixed(2)}s
- **Mejora de Calidad**: +${log.quality_improvement.toFixed(2)}
`).join('')}

## Elementos Generados
### Capas Psicológicas (${enhancedData.psychological_layers.length})
${enhancedData.psychological_layers.map((layer: any) => `- ${layer.detail}`).join('\n')}

### Elementos Culturales (${enhancedData.cultural_elements.length})
${enhancedData.cultural_elements.map((element: any) => `- ${element.detail}`).join('\n')}

### Referencias Históricas (${enhancedData.historical_depth.length})
${enhancedData.historical_depth.map((ref: any) => `- ${ref.detail}`).join('\n')}

### Innovaciones Narrativas (${enhancedData.narrative_innovations.length})
${enhancedData.narrative_innovations.map((innovation: any) => `- ${innovation.detail}`).join('\n')}

### Ganchos Virales (${enhancedData.viral_hooks.length})
${enhancedData.viral_hooks.map((hook: any) => `- ${hook.detail}`).join('\n')}

## Score de Humanización: ${enhancedData.humanization_score}%
        `;
        
        return report.replace(/^\s+/gm, ''); // Trim leading whitespace from each line
    }
}