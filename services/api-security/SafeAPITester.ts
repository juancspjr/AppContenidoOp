/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// 🛡️ SISTEMA DE SEGURIDAD AVANZADO PARA APIS
// ============================================================================
// Basado en investigación de políticas de Google Gemini 2024/2025
// Protege APIs nuevas contra bloqueos y detección de abuso
// ============================================================================

import { GoogleGenAI } from "@google/genai";
import { logger } from '../utils/logger';

interface APITestResult {
    isValid: boolean;
    hasQuota: boolean;
    responseTime: number;
    errorMessage?: string;
    safeToUse: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface SecurityMetrics {
    dailyRequestCount: number;
    hourlyRequestCount: number;
    consecutiveFailures: number;
    lastSuccessTime: number;
    suspicionScore: number;
    cooldownUntil: number;
}

class SafeAPITester {
    private readonly MAX_SAFE_TEST_CALLS = 3; // Límite seguro para testing
    private readonly MIN_TEST_INTERVAL = 10000; // 10 segundos entre tests
    private readonly TEST_PROMPT = "Hello"; // Prompt mínimo para testing
    
    /**
     * Prueba una clave de API de manera segura sin desperdiciar quota
     * @param apiKey Clave a probar
     * @returns Resultado detallado del test
     */
    async safeTestAPIKey(apiKey: string): Promise<APITestResult> {
        const startTime = Date.now();
        const maskedKey = `...${apiKey.slice(-4)}`;
        
        logger.log('INFO', 'SafeAPITester', `Iniciando test seguro de clave ${maskedKey}`);
        
        try {
            // Test básico de autenticación sin gastar quota significativa
            const client = new GoogleGenAI({ apiKey });
            
            const response = await client.models.generateContent({
                model: 'gemini-2.5-flash', // Modelo más económico para testing
                contents: this.TEST_PROMPT,
                config: {
                    maxOutputTokens: 5, // Límite mínimo para reducir costo
                    temperature: 0.1
                }
            });
            
            const responseTime = Date.now() - startTime;
            const hasContent = response.text && response.text.length > 0;
            
            logger.log('SUCCESS', 'SafeAPITester', `Clave ${maskedKey} VÁLIDA - Tiempo: ${responseTime}ms`);
            
            return {
                isValid: true,
                hasQuota: hasContent,
                responseTime,
                safeToUse: true,
                riskLevel: 'LOW'
            };
            
        } catch (error: any) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error.toString().toLowerCase();
            
            // Análisis detallado del error
            if (errorMessage.includes('api key not found') || errorMessage.includes('invalid_argument')) {
                logger.log('ERROR', 'SafeAPITester', `Clave ${maskedKey} INVÁLIDA - Key no encontrada`);
                return {
                    isValid: false,
                    hasQuota: false,
                    responseTime,
                    errorMessage: 'Clave de API inválida',
                    safeToUse: false,
                    riskLevel: 'HIGH'
                };
            }
            
            if (errorMessage.includes('429') || errorMessage.includes('quota exceeded')) {
                logger.log('WARNING', 'SafeAPITester', `Clave ${maskedKey} SIN QUOTA - Límite alcanzado`);
                return {
                    isValid: true,
                    hasQuota: false,
                    responseTime,
                    errorMessage: 'Quota agotada',
                    safeToUse: false, // No usar hasta reset
                    riskLevel: 'MEDIUM'
                };
            }
            
            logger.log('ERROR', 'SafeAPITester', `Clave ${maskedKey} ERROR DESCONOCIDO`, error);
            return {
                isValid: false,
                hasQuota: false,
                responseTime,
                errorMessage: error.message,
                safeToUse: false,
                riskLevel: 'HIGH'
            };
        }
    }
    
    /**
     * Valida si es seguro usar una clave basado en patrones de uso
     */
    isSafeToUseKey(metrics: SecurityMetrics): boolean {
        const now = Date.now();
        
        // En cooldown forzado
        if (metrics.cooldownUntil > now) {
            return false;
        }
        
        // Demasiados fallos consecutivos
        if (metrics.consecutiveFailures >= 5) {
            return false;
        }
        
        // Score de sospecha muy alto
        if (metrics.suspicionScore > 80) {
            return false;
        }
        
        // Límite diario de requests por seguridad (más bajo que el real)
        if (metrics.dailyRequestCount > 20) { // 20 en lugar de 25
            return false;
        }
        
        // Límite por hora para evitar detección de spam
        if (metrics.hourlyRequestCount > 5) { // 5 en lugar de límite real
            return false;
        }
        
        return true;
    }
    
    /**
     * Calcula score de riesgo basado en patrones de uso
     */
    calculateRiskScore(metrics: SecurityMetrics): number {
        let riskScore = 0;
        
        // Penalizar uso intensivo
        riskScore += metrics.dailyRequestCount * 2;
        riskScore += metrics.hourlyRequestCount * 8;
        
        // Penalizar fallos consecutivos
        riskScore += metrics.consecutiveFailures * 15;
        
        // Penalizar si hace mucho que no funciona
        const timeSinceSuccess = Date.now() - metrics.lastSuccessTime;
        if (timeSinceSuccess > 3600000) { // 1 hora
            riskScore += 25;
        }
        
        return Math.min(100, riskScore);
    }
}

export { SafeAPITester, type APITestResult, type SecurityMetrics };