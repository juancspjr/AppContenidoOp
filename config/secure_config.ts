/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// ✅ CONFIGURACIÓN DE CLAVES DE API - ¡ACCIÓN COMPLETADA!
// ============================================================================
//
// Esta aplicación está configurada para ejecutarse sin un backend, lo que
// significa que las claves de API se gestionan en el lado del cliente.
//
// 🚨 ADVERTENCIA DE SEGURIDAD: Exponer las claves de API en una aplicación de
// frontend es arriesgado y solo debe hacerse para proyectos personales, de
// prototipado o de demostración donde el riesgo es aceptable. NUNCA hagas
// esto en una aplicación de producción pública.
//
// Se han añadido 10 claves de API para activar la funcionalidad del proxy.
// El sistema rotará automáticamente entre estas claves si una alcanza su
// límite de cuota.
//
// Puedes añadir hasta 100 claves en total en este array.
//
// ============================================================================

// Obtener las claves de API desde las constantes inyectadas por Vite
declare const __GOOGLE_API_KEYS__: string[];

export const GEMINI_API_KEYS: string[] = __GOOGLE_API_KEYS__ || [];
