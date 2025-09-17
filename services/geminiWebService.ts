/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// ⚠️ IMPLEMENTACIÓN REVERTIDA A SIMULACIÓN DE BACKEND
// ============================================================================
// La librería 'gemini-ai-api' es exclusivamente para Node.js y no puede
// funcionar en el navegador. La implementación directa causaba un error fatal
// al cargar la aplicación.
//
// Esta versión corregida simula la interfaz del servicio y lanza un error
// claro y manejable, explicando por qué la función no está disponible en el
// frontend. Esto soluciona el error de carga y sigue las mejores prácticas
// de arquitectura.
// ============================================================================

interface GeminiWebConfig {
    initialized: boolean;
}

class GeminiWebService {
    private config: GeminiWebConfig = { initialized: false };
    
    private throwBrowserError(): never {
        throw new Error("La librería 'gemini-ai-api' es solo para servidor (Node.js) y no puede ejecutarse en el navegador. Se requiere un backend para la funcionalidad de Gemini Web Unlimited.");
    }
    
    async initialize(cookies: string): Promise<boolean> {
        this.throwBrowserError();
    }
    
    async generateImage(prompt: string, referenceImageBase64?: string): Promise<Blob> {
        this.throwBrowserError();
    }
    
    async analyzeImage(imageBase64: string, analysisPrompt?: string): Promise<string> {
        this.throwBrowserError();
    }
    
    async generateWithAnalyzedReference(prompt: string, referenceImage: File): Promise<{ generatedImage: Blob; analysis: string }> {
        this.throwBrowserError();
    }
    
    isInitialized(): boolean {
        return this.config.initialized;
    }
}

// INSTANCIA GLOBAL
const geminiWebService = new GeminiWebService();

export { geminiWebService };