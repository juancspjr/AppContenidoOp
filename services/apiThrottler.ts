/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ====================================================================================
// ARCHIVO OBSOLETO
// La lógica de este archivo ha sido reemplazada por el sistema más avanzado en
// `services/rateLimiter.ts` y la nueva arquitectura de `apiKeyManager.ts`.
// Este archivo se mantiene para evitar errores de importación en el sistema de
// compilación, pero su contenido ya no se utiliza.
// ====================================================================================

class DeprecatedApiRequestThrottler {
    public schedule<T>(requestFn: () => Promise<T>): Promise<T> {
        console.warn("ADVERTENCIA: Se está llamando al `apiThrottler` obsoleto. La lógica ahora está en `RateLimiter` y se integra directamente en `makeApiRequestWithRetry`.");
        return requestFn();
    }
}

export const apiThrottler = new DeprecatedApiRequestThrottler();
