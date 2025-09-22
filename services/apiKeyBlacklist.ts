/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// 📁 services/apiKeyBlacklist.ts - NUEVO ARCHIVO
// ============================================================================
import { logger } from '../utils/logger';

export interface APIKeyStatus {
    id: string;
    projectName: string;
    status: 'active' | 'quota_exhausted' | 'daily_limit' | 'permanently_blocked';
    lastError?: string;
    exhaustedAt?: number;
    resetAt?: number; // Timestamp cuando se resetea (medianoche PST)
    failureCount: number;
    lastUsedAt?: number;
}

class PersistentAPIKeyManager {
    private static readonly STORAGE_KEY = 'gemini_api_blacklist_v2';
    private static readonly MAX_FAILURES = 3; // Bloquear permanentemente después de 3 fallos de cuota consecutivos

    public static loadAPIStatus(): Map<string, APIKeyStatus> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return new Map();
            
            const parsed = JSON.parse(stored);
            return new Map(Object.entries(parsed));
        } catch (error) {
            logger.log('ERROR', 'APIKeyManager', 'Error cargando estado de APIs desde localStorage', error);
            return new Map();
        }
    }
    
    public static saveAPIStatus(statusMap: Map<string, APIKeyStatus>): void {
        try {
            const obj = Object.fromEntries(statusMap);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
        } catch (error) {
            logger.log('ERROR', 'APIKeyManager', 'Error guardando estado de APIs en localStorage', error);
        }
    }
    
    public static markAsExhausted(keyId: string, keyData: any, errorMessage: string): void {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        const currentStatus: APIKeyStatus = statusMap.get(keyId) || {
            id: keyId,
            projectName: keyData.projectName,
            status: 'active',
            failureCount: 0
        };
        
        currentStatus.failureCount++;
        currentStatus.lastError = errorMessage;
        currentStatus.exhaustedAt = now;
        
        if (errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
            if (currentStatus.failureCount >= this.MAX_FAILURES) {
                currentStatus.status = 'permanently_blocked';
                logger.log('ERROR', 'APIKeyManager', `API ${keyData.projectName} BLOQUEADA PERMANENTEMENTE tras ${currentStatus.failureCount} fallos.`);
            } else if (errorMessage.toLowerCase().includes('daily')) {
                currentStatus.status = 'daily_limit';
                currentStatus.resetAt = this.getNextResetTime();
                logger.log('WARNING', 'APIKeyManager', `API ${keyData.projectName} con límite diario. Se reintentará después de ${new Date(currentStatus.resetAt).toLocaleTimeString()}.`);
            } else {
                currentStatus.status = 'quota_exhausted';
                logger.log('WARNING', 'APIKeyManager', `API ${keyData.projectName} marcada como agotada (fallo ${currentStatus.failureCount}).`);
            }
        }
        
        statusMap.set(keyId, currentStatus);
        this.saveAPIStatus(statusMap);
    }
    
    public static getAvailableAPIs(allKeys: any[]): any[] {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        const available = allKeys.filter(key => {
            const status = statusMap.get(key.id);
            if (!status) return true; // Si no hay estado, está disponible
            
            if (status.status === 'permanently_blocked' || status.status === 'quota_exhausted') {
                return false;
            }
            
            if (status.status === 'daily_limit') {
                if (status.resetAt && now < status.resetAt) {
                    return false;
                } else {
                    // El tiempo de reseteo ha pasado, la reactivamos
                    status.status = 'active';
                    status.failureCount = 0;
                    status.lastError = 'Reseteado automáticamente.';
                    statusMap.set(key.id, status);
                    this.saveAPIStatus(statusMap);
                    return true;
                }
            }
            
            return true; // Active
        });
        logger.log('DEBUG', 'APIKeyManager', `Disponibles ${available.length}/${allKeys.length} APIs.`);
        return available;
    }
    
    public static markAsSuccessful(keyId: string, keyData: any): void {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        const status: APIKeyStatus = statusMap.get(keyId) || {
            id: keyId,
            projectName: keyData.projectName,
            status: 'active',
            failureCount: 0
        };
        
        if (status.status !== 'active') {
            logger.log('SUCCESS', 'APIKeyManager', `API ${keyData.projectName} reactivada tras una llamada exitosa.`);
        }

        status.status = 'active';
        status.failureCount = 0;
        status.lastUsedAt = now;
        status.lastError = undefined;
        
        statusMap.set(keyId, status);
        this.saveAPIStatus(statusMap);
    }
    
    private static getNextResetTime(): number {
        const now = new Date();
        // Google's daily quotas often reset at midnight PST.
        const pstDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
        const nextMidnightPST = new Date(pstDate);
        nextMidnightPST.setDate(pstDate.getDate() + 1);
        nextMidnightPST.setHours(0, 5, 0, 0); // Set to 00:05 PST to be safe
        
        // This returns the timestamp in the user's local timezone that corresponds to midnight PST.
        return new Date(nextMidnightPST.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })).getTime();
    }
    
    public static resetAllAPIs(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        logger.log('INFO', 'APIKeyManager', 'TODOS los estados de API han sido reseteados.');
    }
    
    public static resetSpecificAPI(projectName: string): void {
        const statusMap = this.loadAPIStatus();
        let keyIdToReset: string | null = null;
        
        statusMap.forEach((status, keyId) => {
            if (status.projectName === projectName) {
                keyIdToReset = keyId;
            }
        });
        
        if (keyIdToReset) {
            statusMap.delete(keyIdToReset);
            this.saveAPIStatus(statusMap);
            logger.log('INFO', 'APIKeyManager', `API ${projectName} ha sido reseteada.`);
        }
    }

    public static listAPIStatus(allKeys: any[]): APIKeyStatus[] {
        const statusMap = this.loadAPIStatus();
        return allKeys.map(key => statusMap.get(key.id) || {
            id: key.id,
            projectName: key.projectName,
            status: 'active',
            failureCount: 0
        });
    }

    public static getStats(allKeys: any[]): { total: number; active: number; quotaExhausted: number; dailyLimit: number; permanentlyBlocked: number; } {
        const statusList = this.listAPIStatus(allKeys);
        return {
            total: allKeys.length,
            active: statusList.filter(s => s.status === 'active').length,
            quotaExhausted: statusList.filter(s => s.status === 'quota_exhausted').length,
            dailyLimit: statusList.filter(s => s.status === 'daily_limit').length,
            permanentlyBlocked: statusList.filter(s => s.status === 'permanently_blocked').length,
        };
    }
}

export { PersistentAPIKeyManager };
