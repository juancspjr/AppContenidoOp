/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Parses an unknown error type into a consistent, readable string message in Spanish.
 * This is crucial for displaying user-friendly error messages from various sources
 * (API responses, network errors, exceptions).
 *
 * @param error The unknown error object to parse.
 * @returns A string representing the error message.
 */
export function formatApiError(error: unknown): string {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // New specific check for placeholder keys
        if (message.includes('invalid or placeholder api key')) {
            return "Clave de API inválida o de marcador de posición. Por favor, edita el archivo `config/secure_config.ts` y reemplaza 'YOUR_API_KEY_HERE_...' con tus claves reales de Google AI.";
        }
        
        // Specific Gemini API Errors
        if (message.includes('api key not valid')) {
            return "La clave de API proporcionada no es válida. Por favor, verifica la configuración del sistema.";
        }
        if (message.includes('quota') || message.includes('resource_exhausted')) {
            return "Límite de cuota de API alcanzado. El sistema cambiará a otra clave si está disponible. Por favor, intenta de nuevo en unos momentos.";
        }
        if (message.includes('429')) {
            return "Demasiadas solicitudes a la API (límite de tasa). Por favor, espera un momento antes de reintentar.";
        }
        if (message.includes('503') || message.includes('service unavailable')) {
            return "El servicio de IA no está disponible en este momento. Por favor, intenta de nuevo más tarde.";
        }
        
        // Gemini Web Service (Extension) Errors
        if (message.includes('no se pudo conectar con la extensión')) {
             return "Fallo de conexión con la extensión de Chrome. Asegúrate de que está instalada, activa y que has recargado la página.";
        }
        if (message.includes('cookie') || message.includes('authentication')) {
            return "Error de autenticación con Gemini Web. Tus cookies pueden haber expirado. Por favor, abre la extensión y vuelve a extraerlas.";
        }
        
        // General Network Errors
        if (message.includes('failed to fetch')) {
            return "Error de red. No se pudo conectar con el servidor de IA. Por favor, comprueba tu conexión a internet.";
        }

        return error.message; // Fallback to the original error message
    }
    if (typeof error === 'string') {
        return error;
    }
    
    return "Ocurrió un error desconocido. Revisa la consola para más detalles.";
}