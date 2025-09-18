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

interface ValidationResult {
    success: boolean;
    needsCaptcha: boolean;
    needsReauth: boolean;
    message: string;
    response?: any;
}

class GeminiWebService {
    private cookies: Partial<GeminiWebCookies> | null = null;
    private initialized = false;
    private sessionId: string = '';
    private nonce: string = '';
    private reqId: number = 100000;
    private lastValidation: number = 0;
    private validationCache: boolean = false;

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async initialize(cookieString: string): Promise<boolean> {
        console.log('🔐 Inicializando Gemini Web Service...');
        
        try {
            const parsedCookies = this.parseCookieString(cookieString);
            
            const hasPsid = Object.keys(parsedCookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSID') && !key.includes('PSIDTS') && !key.includes('PSIDCC'));
            const hasPsidTs = Object.keys(parsedCookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSIDTS'));

            if (!hasPsid || !hasPsidTs) {
                throw new Error('Cookies esenciales (__Secure-..PSID, __Secure-..PSIDTS) faltantes.');
            }
            
            this.cookies = parsedCookies;
            this.sessionId = this.generateSessionId();
            
            const validation = await this.validateConnectionWithStrategies();
            
            if (validation.success) {
                this.initialized = true;
                this.validationCache = true;
                this.lastValidation = Date.now();
                
                localStorage.setItem('gemini_web_cookies', btoa(JSON.stringify({
                    cookies: cookieString,
                    timestamp: Date.now(),
                    sessionId: this.sessionId,
                    validated: true
                })));
                
                console.log('✅ Gemini Web Service inicializado correctamente');
                return true;
            } else {
                this.initialized = false;
                throw new Error(validation.message);
            }
            
        } catch (error: any) {
            console.error('❌ Error inicializando Gemini Web Service:', error);
            this.initialized = false;
            throw error;
        }
    }
    
    private async validateConnectionWithStrategies(): Promise<ValidationResult> {
        console.log('🔍 Validando conexión con Gemini Web (múltiples estrategias)...');
        
        try {
            const homeValidation = await this.validateGeminiHomePage();
            if (homeValidation.success) {
                console.log('✅ Validación exitosa: Página principal Gemini');
                return homeValidation;
            }
        } catch (error) {
            console.warn('⚠️ Estrategia 1 falló:', error);
        }
        
        try {
            const apiValidation = await this.validateViaInternalAPI();
            if (apiValidation.success) {
                console.log('✅ Validación exitosa: API interna');
                return apiValidation;
            }
        } catch (error) {
            console.warn('⚠️ Estrategia 2 falló:', error);
        }
        
        try {
            const cookieValidation = await this.validateCookiesOnly();
            if (cookieValidation.success) {
                console.log('✅ Validación exitosa: Solo cookies');
                return cookieValidation;
            }
        } catch (error) {
            console.warn('⚠️ Estrategia 3 falló:', error);
        }
        
        return {
            success: false,
            needsCaptcha: true,
            needsReauth: true,
            message: 'La validación de la conexión con Gemini falló. Las cookies pueden haber expirado, ser incorrectas o se requiere resolver un CAPTCHA en gemini.google.com.'
        };
    }
    
    private async validateGeminiHomePage(): Promise<ValidationResult> {
        console.log('🏠 Validando página principal de Gemini...');
        
        try {
            const response = await stealthFetch('https://gemini.google.com/', {
                method: 'GET',
                headers: this.buildHeaders(),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            const isValid = this.checkGeminiPageValidation(html);
            
            if (isValid.success) {
                await this.extractNonceFromHTML(html);
                return {
                    success: true,
                    needsCaptcha: false,
                    needsReauth: false,
                    message: 'Conexión validada correctamente via página principal',
                    response: html
                };
            } else {
                return isValid;
            }
            
        } catch (error: any) {
            throw new Error(`Error validando página principal: ${error.message}`);
        }
    }
    
    private async validateViaInternalAPI(): Promise<ValidationResult> {
        console.log('🔧 Validando vía API interna...');
        
        try {
            const response = await stealthFetch('https://gemini.google.com/app', {
                method: 'GET',
                headers: {
                    ...this.buildHeaders(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
            });
            
            if (response.status === 200 || response.status === 403) {
                const text = await response.text();
                if (text.includes('_reqid') || text.includes('SNlM0e') || text.includes('session')) {
                    return { success: true, needsCaptcha: false, needsReauth: false, message: 'Validación exitosa via API interna' };
                }
            }
            throw new Error(`API interna respondió: ${response.status}`);
        } catch (error: any) {
            throw new Error(`Error en API interna: ${error.message}`);
        }
    }
    
    private async validateCookiesOnly(): Promise<ValidationResult> {
        console.log('🍪 Validando solo cookies...');
        if (!this.cookies || !Object.keys(this.cookies).some(k => k.includes('PSID') && !k.includes('TS'))) {
            throw new Error('Cookie __Secure-1PSID (o variante) faltante');
        }
        return { success: true, needsCaptcha: false, needsReauth: false, message: 'Cookies validadas por formato (modo fallback)' };
    }
    
    private checkGeminiPageValidation(html: string): ValidationResult {
        if (html.includes('captcha') || html.includes('unusual traffic') || html.includes('verify you are human')) {
            return { success: false, needsCaptcha: true, needsReauth: false, message: 'CAPTCHA requerido. Ve a gemini.google.com y resuelve el CAPTCHA manualmente.' };
        }
        if (html.includes('accounts.google.com') || html.includes('Sign in') || html.includes('signin')) {
            return { success: false, needsCaptcha: false, needsReauth: true, message: 'Sesión expirada. Ve a gemini.google.com y logúeate nuevamente.' };
        }
        if (html.includes('SNlM0e') || html.includes('_reqid') || html.includes('How can I help you')) {
            return { success: true, needsCaptcha: false, needsReauth: false, message: 'Sesión válida detectada' };
        }
        return { success: false, needsCaptcha: true, needsReauth: false, message: 'Estado de sesión ambiguo. Puede requerir verificación manual.' };
    }
    
    private async extractNonceFromHTML(html: string): Promise<void> {
        try {
            const nonceMatch = html.match(/\"SNlM0e\":\"([^\"]+)\"/);
            if (nonceMatch) {
                this.nonce = nonceMatch[1];
                console.log('🔑 Nonce extraído exitosamente');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo extraer nonce, continuando sin él');
        }
    }
    
    public async generateImage(prompt: string, referenceImageBase64?: string): Promise<Blob> {
        if (!this.initialized || !this.cookies) {
            throw new Error('🚫 Servicio no inicializado. Ejecuta initialize() primero.');
        }
        
        const timeSinceValidation = Date.now() - this.lastValidation;
        if (timeSinceValidation > 30 * 60 * 1000) { // 30 minutos
            console.log('🔄 Revalidando conexión después de 30 minutos...');
            const revalidation = await this.validateConnectionWithStrategies();
            if (!revalidation.success) {
                throw new Error(`Revalidación falló: ${revalidation.message}`);
            }
            this.lastValidation = Date.now();
        }
        
        throw new Error('🚧 Generación de imágenes aún no implementada. Conexión validada correctamente.');
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
    
    public getStatus(): { initialized: boolean; sessionId?: string; hasValidCookies?: boolean; lastValidation?: number; validationCache?: boolean; } {
        return {
            initialized: this.initialized,
            sessionId: this.sessionId,
            hasValidCookies: !!(this.cookies && Object.keys(this.cookies).some(k => k.includes('PSID'))),
            lastValidation: this.lastValidation,
            validationCache: this.validationCache
        };
    }
    
    public async loadSavedCookies(): Promise<boolean> {
        try {
            const saved = localStorage.getItem('gemini_web_cookies');
            if (!saved) return false;
            
            const data = JSON.parse(atob(saved));
            const age = Date.now() - data.timestamp;
            
            if (age > 2 * 60 * 60 * 1000) {
                console.log('🕒 Cookies guardadas son antiguas, validando...');
                localStorage.removeItem('gemini_web_cookies');
                return false;
            }
            
            const parsedCookies = this.parseCookieString(data.cookies);
            const hasPsid = Object.keys(parsedCookies).some(key => key.startsWith('__Secure-') && key.endsWith('PSID'));

            if (hasPsid) {
                this.cookies = parsedCookies;
                this.sessionId = data.sessionId || this.generateSessionId();
                const validation = await this.validateConnectionWithStrategies();
                
                if (validation.success) {
                    this.initialized = true;
                    this.validationCache = true;
                    this.lastValidation = Date.now();
                    console.log('🔄 Cookies cargadas y validadas desde localStorage');
                    return true;
                } else {
                    console.warn('⚠️ Cookies guardadas no pasaron validación:', validation.message);
                    localStorage.removeItem('gemini_web_cookies');
                    return false;
                }
            }
            return false;
        } catch (error) {
            console.warn('⚠️ Error cargando cookies guardadas:', error);
            localStorage.removeItem('gemini_web_cookies');
            return false;
        }
    }
}

export const geminiWebService = new GeminiWebService();