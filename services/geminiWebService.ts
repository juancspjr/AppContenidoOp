// REEMPLAZAR TODO EL CONTENIDO CON:

interface GeminiWebConfig {
  cookies: string;
  initialized: boolean;
}

class GeminiWebService {
  private config: GeminiWebConfig = {
    cookies: '',
    initialized: false
  };

  /**
   * Inicializa el servicio con cookies de la extensión Chrome
   */
  async initialize(cookieString: string): Promise<void> {
    if (!cookieString || cookieString.trim() === '') {
      throw new Error('Cookie string no puede estar vacío');
    }

    // Validar que contiene cookies críticas de Google
    const criticalCookies = ['__Secure-1PSID', 'APISID', 'SAPISID'];
    const hasRequired = criticalCookies.some(name => 
      cookieString.includes(`${name}=`)
    );

    if (!hasRequired) {
      throw new Error('Las cookies no contienen tokens de autenticación de Google requeridos');
    }

    this.config.cookies = cookieString;
    this.config.initialized = true;

    console.log('✅ GeminiWebService inicializado con cookies de extensión');
  }

  /**
   * Verifica si el servicio está inicializado
   */
  isInitialized(): boolean {
    return this.config.initialized;
  }

  /**
   * Obtiene las cookies configuradas
   */
  getCookies(): string {
    if (!this.config.initialized) {
      throw new Error('GeminiWebService no está inicializado. Conecta la extensión primero.');
    }
    return this.config.cookies;
  }

  /**
   * Realiza una petición a Gemini Web usando las cookies de la extensión
   */
  async makeGeminiWebRequest(endpoint: string, data: any): Promise<Response> {
    if (!this.config.initialized) {
      throw new Error('GeminiWebService no está inicializado. Conecta la extensión primero.');
    }

    const headers = {
      'Cookie': this.config.cookies,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://gemini.google.com/',
      'Origin': 'https://gemini.google.com'
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Gemini Web request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  /**
   * Reinicia el servicio (limpia cookies)
   */
  reset(): void {
    this.config = {
      cookies: '',
      initialized: false
    };
    console.log('🔄 GeminiWebService reiniciado');
  }
}

// Instancia singleton
const geminiWebService = new GeminiWebService();

// Función de conveniencia para inicializar
export const initializeGeminiWeb = (cookieString: string) => {
  return geminiWebService.initialize(cookieString);
};

// Exportar instancia por defecto
export default geminiWebService;

// Verificar status
export const isGeminiWebReady = () => geminiWebService.isInitialized();

// Obtener cookies
export const getGeminiWebCookies = () => geminiWebService.getCookies();