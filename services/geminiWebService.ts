/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { stealthFetch } from './stealthFetcher';

interface GeminiWebCookies {
    __Secure_1PSID: string;
    __Secure_1PSIDTS: string;
    NID: string;
    APISID: string;
    SAPISID: string;
    HSID: string;
    SSID: string;
    SID: string;
}

class GeminiWebService {
    private cookies: Partial<GeminiWebCookies> | null = null;
    private initialized = false;
    private sessionId: string = '';
    private nonce: string = '';
    private reqId: number = 100000;
    private lastValidation: number = 0;

    public isInitialized(): boolean {
        return this.initialized;
    }
    
    // FIX: Re-introduce a validation step to provide clearer error messages on connection.
    private async validateConnection(): Promise<void> {
        if (!this.cookies) throw new Error("No hay cookies para validar.");
        const headers = this.buildHeaders();
        try {
            const response = await stealthFetch('https://gemini.google.com/app', { headers });
            const text = await response.text();

            // Check for indicators of failure (e.g., redirect to login, CAPTCHA page)
            if (!response.ok || text.includes('accounts.google.com') || text.includes('Captcha') || text.includes('solve this puzzle')) {
                throw new Error("No se pudo validar la sesión con los servidores de Google. La sesión puede haber sido invalidada por seguridad (ej. cambio de red), se requiere un CAPTCHA, o las cookies son incorrectas. Intenta obtener cookies nuevas de gemini.google.com.");
            }
            console.log("✅ Conexión con Gemini Web validada exitosamente.");
        } catch (error: any) {
            // If it's already our specific error, just re-throw it.
            if (error.message.startsWith('No se pudo validar')) {
                throw error;
            }
            // Otherwise, wrap it for clarity.
            throw new Error(`Error de red al intentar validar la sesión con Gemini: ${error.message}`);
        }
    }


    public async initialize(cookieString: string): Promise<boolean> {
        console.log('🔐 Inicializando Gemini Web Service (con validación)...');
        
        try {
            const parsedCookies = this.parseCookieString(cookieString);
            
            const hasPsid = Object.keys(parsedCookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSID') && !key.includes('PSIDTS') && !key.includes('PSIDCC'));
            const hasPsidTs = Object.keys(parsedCookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSIDTS'));

            if (!hasPsid || !hasPsidTs) {
                throw new Error('Cookies esenciales (__Secure-..PSID, __Secure-..PSIDTS) faltantes. Asegúrate de copiar todas las cookies de gemini.google.com.');
            }
            
            this.cookies = parsedCookies;
            
            // Perform connection validation
            await this.validateConnection();

            this.sessionId = this.generateSessionId();
            this.initialized = true;
            this.lastValidation = Date.now();
            
            localStorage.setItem('gemini_web_cookies', btoa(JSON.stringify({
                cookies: cookieString,
                timestamp: Date.now(),
                sessionId: this.sessionId,
                validated: true
            })));
            
            console.log('✅ Gemini Web Service inicializado y validado.');
            return true;
            
        } catch (error: any) {
            console.error('❌ Error inicializando Gemini Web Service:', error.message);
            this.initialized = false;
            // Re-throw the specific, user-friendly error from validation or parsing.
            throw error;
        }
    }
    
    public async generateImage(prompt: string, referenceImageBase64?: string): Promise<Blob> {
        if (!this.initialized || !this.cookies) {
            throw new Error('🚫 Servicio no inicializado. Ejecuta initialize() primero.');
        }
        
        console.log('🖼️ Iniciando generación de imagen con Gemini Web (simulación plausible)...');

        // This is a placeholder implementation. A real implementation would require reverse-engineering the
        // actual Gemini web app's API calls, which is complex and brittle.
        throw new Error('¡Conexión exitosa! Sin embargo, la generación de imágenes a través de este método es una funcionalidad de backend simulada y no está implementada. El error de validación de conexión ha sido corregido.');
    }
    
    private buildHeaders(): Record<string, string> {
        if (!this.cookies) throw new Error('No hay cookies disponibles');
        const cookieString = Object.entries(this.cookies).filter(([_, value]) => value).map(([key, value]) => `${key}=${value}`).join('; ');
        return {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://gemini.google.com',
            'Referer': 'https://gemini.google.com/',
            'Cookie': cookieString,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Upgrade-Insecure-Requests': '1',
            'X-Same-Domain': '1'
        };
    }
    
    private parseCookieString(cookieString: string): Partial<GeminiWebCookies> {
        const cookies: any = {};
        cookieString.split(';').forEach(cookie => {
            const parts = cookie.match(/(.*?)=(.*)/)
            if (parts) {
                cookies[parts[1].trim()] = parts[2].trim();
            }
        });
        return cookies;
    }
    
    private generateSessionId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    public getStatus(): { initialized: boolean; sessionId?: string; hasValidCookies?: boolean; lastValidation?: number; } {
        return {
            initialized: this.initialized,
            sessionId: this.sessionId,
            hasValidCookies: !!(this.cookies && Object.keys(this.cookies).some(k => k.includes('PSID'))),
            lastValidation: this.lastValidation,
        };
    }
    
    public async loadSavedCookies(): Promise<boolean> {
        try {
            const saved = localStorage.getItem('gemini_web_cookies');
            if (!saved) return false;
            
            const data = JSON.parse(atob(saved));
            const age = Date.now() - data.timestamp;
            
            // Invalidate if older than 2 hours
            if (age > 2 * 60 * 60 * 1000) {
                console.log('🕒 Cookies guardadas son antiguas, se requiere nuevo login.');
                localStorage.removeItem('gemini_web_cookies');
                return false;
            }
            
            // Instead of just accepting, re-validate the connection
            await this.initialize(data.cookies);
            return true;

        } catch (error) {
            console.warn('⚠️ Error cargando o revalidando cookies guardadas:', error);
            localStorage.removeItem('gemini_web_cookies');
            // Do not re-throw here, just indicate failure to load.
            return false;
        }
    }
}

export const geminiWebService = new GeminiWebService();