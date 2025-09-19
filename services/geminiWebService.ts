/**
 * @license
 * SPDX-License-identifier: Apache-2.0
*/

// ============================================================================
// 🤖 SERVICIO DE FALLBACK DE GEMINI WEB (PARA GENERACIÓN ILIMITADA)
// ============================================================================
import { stealthFetch } from './stealthFetcher';
import { logger } from '../utils/logger';

interface UploadResult {
    id: string;
    filename: string;
}

class GeminiWebService {
    private cookieString: string | null = null;
    private initialized = false;

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async initialize(cookies: string): Promise<void> {
        if (!cookies) {
            throw new Error("Las cookies de autenticación son requeridas para inicializar GeminiWebService.");
        }
        this.cookieString = cookies;
        this.initialized = true;
        logger.log('SUCCESS', 'GeminiWebService', 'Servicio inicializado exitosamente con cookies.');
    }

    private deinitialize() {
        logger.log('WARNING', 'GeminiWebService', 'Des-inicializando servicio. Se requiere reconexión.');
        this.cookieString = null;
        this.initialized = false;
    }

    private checkInitialized(): void {
        if (!this.initialized || !this.cookieString) {
            throw new Error("Servicio Gemini Web no inicializado. Conéctate a través de la extensión primero.");
        }
    }
    
    public async healthCheck(): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            // A lightweight check: try to access the main Gemini page.
            // A 200 OK response indicates the cookies are still valid for navigation.
            const response = await stealthFetch("https://gemini.google.com/", {
                method: 'GET',
                headers: { 'Cookie': this.cookieString! },
                redirect: 'follow'
            });
            if (!response.ok || response.redirected) {
                logger.log('WARNING', 'GeminiWebService', `Health check fallido con estado: ${response.status}`);
                this.deinitialize();
                return false;
            }
            return true;
        } catch (error) {
            logger.log('ERROR', 'GeminiWebService', 'Health check falló con una excepción.', error);
            this.deinitialize();
            return false;
        }
    }


    private async uploadFile(file: File): Promise<UploadResult> {
        this.checkInitialized();
        const UPLOAD_URL = "https://gemini.google.com/_/upload/photos";

        const formData = new FormData();
        formData.append('file', file, file.name);

        const response = await stealthFetch(UPLOAD_URL, {
            method: 'POST',
            headers: { 'Cookie': this.cookieString! },
            body: formData,
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                this.deinitialize();
                throw new Error("Error de autenticación subiendo archivo. Las cookies pueden haber expirado.");
            }
            throw new Error(`Error en la subida de archivo: ${response.status} ${response.statusText}`);
        }
        
        const responseText = await response.text();
        try {
            const jsonStr = `[${responseText.split('\n')[1].substring(2)}]`;
            const parsed = JSON.parse(jsonStr);
            return { id: parsed[0], filename: parsed[1] };
        } catch (e) {
            throw new Error("Fallo al parsear la respuesta de la subida de archivo.");
        }
    }
    
    public async generateImage(prompt: string, referenceFiles: File[] = []): Promise<Blob> {
        this.checkInitialized();
        const GENERATE_URL = "https://gemini.google.com/upload/imghp";
        
        let finalPrompt = prompt;
        const uploadedFiles = [];

        for (const file of referenceFiles) {
            const result = await this.uploadFile(file);
            uploadedFiles.push(result);
        }
        
        const fileReferences = uploadedFiles.map(f => `[f_img/${f.id}] ${f.filename}`).join(' ');
        finalPrompt = `${fileReferences} ${prompt}`.trim();

        const params = new URLSearchParams({
            'prompt': finalPrompt,
            'hl': 'es',
            'bl': 'boq_gemini_20240522.01_p1'
        });
        
        const response = await stealthFetch(`${GENERATE_URL}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Cookie': this.cookieString! },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                this.deinitialize();
                throw new Error("Error de autenticación generando imagen. Las cookies pueden haber expirado.");
            }
            throw new Error(`Error en la generación de imagen: ${response.status} ${response.statusText}`);
        }

        return response.blob();
    }
}

const geminiWebService = new GeminiWebService();
export default geminiWebService;
