/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================================
// 🔒 MONITOR DE SEGURIDAD PARA PROTECCIÓN DE APIS
// ============================================================================
// Implementa patrones seguros basados en políticas de Google 2024/2025
// Previene suspensiones y bloqueos por abuso detectado
// ============================================================================

import { logger } from '../../utils/logger';

interface KeySecurityProfile {
    keyId: string;
    maskedKey: string;
    createdAt: number;
    
    // Métricas de uso
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    
    // Métricas temporales
    requestsToday: number;
    requestsThisHour: number;
    lastRequestTime: number;
    lastSuccessTime: number;
    
    // Estado de seguridad
    consecutiveFailures: number;
    suspicionScore: number;
    cooldownUntil: number;
    isBlacklisted: boolean;
    
    // Historial de errores
    error429Count: number; // Rate limit
    error403Count: number; // Quota exceeded
    error400Count: number; // Invalid key
}

class SecurityMonitor {
    private profiles: Map<string, KeySecurityProfile> = new Map();
    private readonly SAFE_DAILY_LIMIT = 20; // Buffer de seguridad
    private readonly SAFE_HOURLY_LIMIT = 5;
    private readonly MAX_CONSECUTIVE_FAILURES = 3;
    private readonly COOLDOWN_PERIODS = {
        RATE_LIMIT: 60 * 60 * 1000, // 1 hora para 429
        QUOTA_EXCEEDED: 24 * 60 * 60 * 1000, // 24 horas para quota
        INVALID_KEY: 7 * 24 * 60 * 60 * 1000, // 1 semana para keys inválidas
        HIGH_SUSPICION: 12 * 60 * 60 * 1000 // 12 horas para actividad sospechosa
    };
    
    /**
     * Registra una nueva clave para monitoreo
     */
    registerKey(apiKey: string): void {
        const keyId = this.generateKeyId(apiKey);
        const maskedKey = `...${apiKey.slice(-4)}`;
        
        if (!this.profiles.has(keyId)) {
            const profile: KeySecurityProfile = {
                keyId,
                maskedKey,
                createdAt: Date.now(),
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                requestsToday: 0,
                requestsThisHour: 0,
                lastRequestTime: 0,
                lastSuccessTime: 0,
                consecutiveFailures: 0,
                suspicionScore: 0,
                cooldownUntil: 0,
                isBlacklisted: false,
                error429Count: 0,
                error403Count: 0,
                error400Count: 0
            };
            
            this.profiles.set(keyId, profile);
            logger.log('INFO', 'SecurityMonitor', `Clave ${maskedKey} registrada para monitoreo`);
        }
    }
    
    /**
     * Evalúa si es seguro usar una clave específica
     */
    isSafeToUse(apiKey: string): boolean {
        const keyId = this.generateKeyId(apiKey);
        const profile = this.profiles.get(keyId);
        
        if (!profile) {
            logger.log('WARNING', 'SecurityMonitor', 'Intento de usar clave no registrada');
            return false;
        }
        
        const now = Date.now();
        
        // Verificaciones de seguridad críticas
        const checks = [
            { condition: profile.isBlacklisted, reason: 'Clave en lista negra' },
            { condition: profile.cooldownUntil > now, reason: 'En período de cooldown' },
            { condition: profile.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES, reason: 'Demasiados fallos consecutivos' },
            { condition: profile.requestsToday >= this.SAFE_DAILY_LIMIT, reason: 'Límite diario de seguridad alcanzado' },
            { condition: profile.requestsThisHour >= this.SAFE_HOURLY_LIMIT, reason: 'Límite por hora alcanzado' },
            { condition: profile.suspicionScore > 70, reason: 'Score de sospecha muy alto' }
        ];
        
        for (const check of checks) {
            if (check.condition) {
                logger.log('WARNING', 'SecurityMonitor', 
                    `Clave ${profile.maskedKey} bloqueada: ${check.reason}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Registra el resultado de una llamada API
     */
    recordAPICall(apiKey: string, success: boolean, errorCode?: number): void {
        const keyId = this.generateKeyId(apiKey);
        const profile = this.profiles.get(keyId);
        
        if (!profile) {
            logger.log('ERROR', 'SecurityMonitor', 'Intento de registrar llamada en clave no registrada');
            return;
        }
        
        const now = Date.now();
        
        // Actualizar contadores básicos
        profile.totalRequests++;
        profile.lastRequestTime = now;
        this.updateTimeBasedCounters(profile, now);
        
        if (success) {
            profile.successfulRequests++;
            profile.lastSuccessTime = now;
            profile.consecutiveFailures = 0; // Reset en caso de éxito
            profile.suspicionScore = Math.max(0, profile.suspicionScore - 5); // Reducir sospecha
            
            logger.log('DEBUG', 'SecurityMonitor', 
                `Llamada exitosa registrada para ${profile.maskedKey}`);
        } else {
            profile.failedRequests++;
            profile.consecutiveFailures++;
            this.handleFailure(profile, errorCode);
        }
        
        // Recalcular score de sospecha
        this.updateSuspicionScore(profile);
    }
    
    /**
     * Maneja diferentes tipos de fallos
     */
    private handleFailure(profile: KeySecurityProfile, errorCode?: number): void {
        const now = Date.now();
        
        switch (errorCode) {
            case 429: // Rate limit exceeded
                profile.error429Count++;
                profile.cooldownUntil = now + this.COOLDOWN_PERIODS.RATE_LIMIT;
                profile.suspicionScore += 20;
                logger.log('WARNING', 'SecurityMonitor', 
                    `Rate limit detectado en ${profile.maskedKey} - Cooldown aplicado`);
                break;
                
            case 403: // Quota exceeded
                profile.error403Count++;
                profile.cooldownUntil = now + this.COOLDOWN_PERIODS.QUOTA_EXCEEDED;
                profile.suspicionScore += 15;
                logger.log('WARNING', 'SecurityMonitor', 
                    `Quota agotada en ${profile.maskedKey} - Cooldown extendido`);
                break;
                
            case 400: // Invalid API key
                profile.error400Count++;
                profile.isBlacklisted = true;
                profile.cooldownUntil = now + this.COOLDOWN_PERIODS.INVALID_KEY;
                logger.log('ERROR', 'SecurityMonitor', 
                    `Clave inválida ${profile.maskedKey} - Agregada a lista negra`);
                break;
                
            default:
                profile.suspicionScore += 10;
                logger.log('WARNING', 'SecurityMonitor', 
                    `Error desconocido en ${profile.maskedKey} - Código: ${errorCode}`);
        }
    }
    
    /**
     * Actualiza contadores basados en tiempo
     */
    private updateTimeBasedCounters(profile: KeySecurityProfile, now: number): void {
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        const oneHourAgo = now - (60 * 60 * 1000);
        
        // Resetear contadores si ha pasado el tiempo
        if (profile.lastRequestTime < oneDayAgo) {
            profile.requestsToday = 0;
        }
        
        if (profile.lastRequestTime < oneHourAgo) {
            profile.requestsThisHour = 0;
        }
        
        profile.requestsToday++;
        profile.requestsThisHour++;
    }
    
    /**
     * Actualiza el score de sospecha basado en patrones
     */
    private updateSuspicionScore(profile: KeySecurityProfile): void {
        const failureRate = profile.failedRequests / Math.max(1, profile.totalRequests);
        
        // Penalizar alta tasa de fallos
        if (failureRate > 0.5) {
            profile.suspicionScore += 30;
        } else if (failureRate > 0.3) {
            profile.suspicionScore += 15;
        }
        
        // Penalizar uso intensivo sospechoso
        if (profile.requestsThisHour > 10) {
            profile.suspicionScore += 25;
        }
        
        // Limitar score máximo
        profile.suspicionScore = Math.min(100, profile.suspicionScore);
    }
    
    /**
     * Obtiene estadísticas de seguridad
     */
    getSecurityReport(): any {
        const report = {
            totalKeys: this.profiles.size,
            activeKeys: 0,
            blacklistedKeys: 0,
            keysInCooldown: 0,
            highRiskKeys: 0,
            keyDetails: [] as any[]
        };
        
        const now = Date.now();
        
        for (const profile of this.profiles.values()) {
            if (profile.isBlacklisted) {
                report.blacklistedKeys++;
            } else if (profile.cooldownUntil > now) {
                report.keysInCooldown++;
            } else if (profile.suspicionScore > 50) {
                report.highRiskKeys++;
            } else {
                report.activeKeys++;
            }
            
            report.keyDetails.push({
                maskedKey: profile.maskedKey,
                status: this.getKeyStatus(profile, now),
                suspicionScore: profile.suspicionScore,
                totalRequests: profile.totalRequests,
                successRate: (profile.successfulRequests / Math.max(1, profile.totalRequests) * 100).toFixed(1) + '%'
            });
        }
        
        return report;
    }
    
    private getKeyStatus(profile: KeySecurityProfile, now: number): string {
        if (profile.isBlacklisted) return 'BLACKLISTED';
        if (profile.cooldownUntil > now) return 'COOLDOWN';
        if (profile.suspicionScore > 70) return 'HIGH_RISK';
        if (profile.suspicionScore > 40) return 'MEDIUM_RISK';
        return 'ACTIVE';
    }
    
    private generateKeyId(apiKey: string): string {
        // Simple hash para identificar claves sin almacenar la clave completa
        let hash = 0;
        for (let i = 0; i < apiKey.length; i++) {
            const char = apiKey.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString();
    }
}

export { SecurityMonitor, type KeySecurityProfile };