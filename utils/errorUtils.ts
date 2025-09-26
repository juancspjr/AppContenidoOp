/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Custom error class for validation failures.
 */
export class ValidationError extends Error {
    public field?: string;
    constructor(message: string, field?: string) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}


/**
 * Parses an unknown error type into a consistent, readable string message in Spanish.
 * This is crucial for displaying user-friendly error messages from various sources
 * (API responses, network errors, exceptions).
 *
 * @param error The unknown error object to parse.
 * @returns A string representing the error message.
 */
export function formatApiError(error: unknown): string {
    if (error instanceof ValidationError) {
        return error.message;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        if (message.includes('api key not valid')) {
            return "La clave de API proporcionada no es válida. Por favor, verifica la configuración del sistema.";
        }
        if (message.includes('quota') || message.includes('resource_exhausted') || message.includes('429')) {
            return "Límite de cuota de API alcanzado. El sistema intentará reintentar. Por favor, espera unos momentos.";
        }
        if (message.includes('503') || message.includes('service unavailable') || message.includes('model is unavailable')) {
            return "El servicio de IA no está disponible en este momento. Por favor, intenta de nuevo más tarde.";
        }
         if (message.includes('invalid_argument') || message.includes('invalid input')) {
            return 'Formato de solicitud inválido. La IA no pudo procesar los datos. Intenta con una idea o texto más simple.';
        }
        if (message.includes('timeout') || message.includes('network') || message.includes('failed to fetch')) {
            return "Error de red. No se pudo conectar con el servidor de IA. Por favor, comprueba tu conexión a internet.";
        }

        return error.message; // Fallback to the original error message
    }
    if (typeof error === 'string') {
        return error;
    }
    
    return "Ocurrió un error desconocido. Revisa la consola para más detalles.";
}
