/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ⚠️ REFACTORIZACIÓN DE SEGURIDAD CRÍTICA ⚠️
//
// Las claves de API han sido eliminadas permanentemente de este archivo del lado del cliente.
// Toda la lógica de llamadas a la API de Google, incluyendo la gestión y rotación de claves,
// ha sido movida a un proxy de backend simulado (ubicado en `services/geminiService.ts`)
// para emular una arquitectura segura.
//
// EN UN ENTORNO DE PRODUCCIÓN REAL:
// 1. Las claves de API NUNCA deben estar en el código del frontend.
// 2. Deben residir en variables de entorno en un servidor backend (por ejemplo, Node.js, Python, Go).
// 3. El frontend debe realizar llamadas a su propio backend (ej. `fetch('/api/generate-image')`).
// 4. El backend, a su vez, realiza la llamada segura a la API de Google con la clave apropiada.
//
// Este cambio soluciona la vulnerabilidad de seguridad más importante de la aplicación.

export const APIConfig = {
    /**
     * Endpoint del proxy de backend (simulado). En una aplicación real, este sería el
     * URL de tu propio servidor.
     */
    BACKEND_API_ENDPOINT: '/api/gemini/v1',
};
