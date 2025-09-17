/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// 📁 services/apiKeyBlacklist.ts - NUEVO ARCHIVO
// ============================================================================

export interface APIKeyStatus {
    id: string;
    api_key: string;
    projectName: string;
    status: 'active' | 'quota_exhausted' | 'daily_limit' | 'permanently_blocked';
    lastError?: string;
    exhaustedAt?: number;
    resetAt?: number; // Timestamp cuando se resetea (medianoche PST)
    failureCount: number;
    lastUsedAt?: number;
}

class PersistentAPIKeyManager {
    private static readonly STORAGE_KEY = 'gemini_api_blacklist';
    private static readonly MAX_FAILURES = 2; // Después de 2 fallos, bloquear permanently
    
    // CARGAR ESTADO DESDE LOCALSTORAGE
    public static loadAPIStatus(): Map<string, APIKeyStatus> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return new Map();
            
            const parsed = JSON.parse(stored);
            const statusMap = new Map<string, APIKeyStatus>();
            
            Object.entries(parsed).forEach(([keyId, status]) => {
                statusMap.set(keyId, status as APIKeyStatus);
            });
            
            return statusMap;
        } catch (error) {
            console.error('❌ Error cargando estado de APIs:', error);
            return new Map();
        }
    }
    
    // GUARDAR ESTADO EN LOCALSTORAGE
    public static saveAPIStatus(statusMap: Map<string, APIKeyStatus>): void {
        try {
            const obj: Record<string, APIKeyStatus> = {};
            statusMap.forEach((status, keyId) => {
                obj[keyId] = status;
            });
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj, null, 2));
            console.log(`💾 Estado de APIs guardado: ${statusMap.size} claves monitoreadas`);
        } catch (error) {
            console.error('❌ Error guardando estado de APIs:', error);
        }
    }
    
    // MARCAR API COMO AGOTADA PERMANENTEMENTE
    static markAsExhausted(keyId: string, keyData: any, errorMessage: string): void {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        // FIX: Explicitly type `currentStatus` to `APIKeyStatus` to allow access to optional properties.
        const currentStatus: APIKeyStatus = statusMap.get(keyId) || {
            id: keyId,
            api_key: keyData.api_key,
            projectName: keyData.projectName,
            status: 'active',
            failureCount: 0
        };
        
        currentStatus.failureCount++;
        currentStatus.lastError = errorMessage;
        currentStatus.exhaustedAt = now;
        
        // SI ES ERROR DE QUOTA, MARCAR COMO AGOTADA
        if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('429')) {
            if (currentStatus.failureCount >= this.MAX_FAILURES) {
                currentStatus.status = 'permanently_blocked';
                console.log(`🚫 API ${keyData.projectName} BLOQUEADA PERMANENTEMENTE (${currentStatus.failureCount} fallos)`);
            } else if (errorMessage.includes('daily')) {
                currentStatus.status = 'daily_limit';
                currentStatus.resetAt = this.getNextResetTime();
                console.log(`⏰ API ${keyData.projectName} agotada hasta medianoche PST`);
            } else {
                currentStatus.status = 'quota_exhausted';
                console.log(`❌ API ${keyData.projectName} marcada como agotada (fallo ${currentStatus.failureCount})`);
            }
        }
        
        statusMap.set(keyId, currentStatus);
        this.saveAPIStatus(statusMap);
    }
    
    // OBTENER APIS DISPONIBLES (NO AGOTADAS)
    static getAvailableAPIs(allKeys: any[]): any[] {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        return allKeys.filter(key => {
            const status = statusMap.get(key.id);
            
            // SI NO HAY ESTADO, ESTÁ DISPONIBLE
            if (!status) return true;
            
            // SI ESTÁ BLOQUEADA PERMANENTEMENTE, NO USAR
            if (status.status === 'permanently_blocked') {
                console.log(`🚫 Saltando API ${key.projectName}: bloqueada permanentemente`);
                return false;
            }
            
            // SI ESTÁ AGOTADA POR QUOTA, NO USAR
            if (status.status === 'quota_exhausted') {
                console.log(`❌ Saltando API ${key.projectName}: quota agotada`);
                return false;
            }
            
            // SI ESTÁ AGOTADA POR LÍMITE DIARIO, VERIFICAR SI YA SE RESETEÓ
            if (status.status === 'daily_limit') {
                if (status.resetAt && now < status.resetAt) {
                    console.log(`⏰ Saltando API ${key.projectName}: límite diario hasta ${new Date(status.resetAt).toLocaleString()}`);
                    return false;
                } else {
                    // RESETEAR STATUS SI YA PASÓ LA MEDIANOCHE
                    console.log(`🔄 API ${key.projectName} reseteada - límite diario renovado`);
                    status.status = 'active';
                    status.failureCount = 0;
                    statusMap.set(key.id, status);
                    this.saveAPIStatus(statusMap);
                    return true;
                }
            }
            
            return true;
        });
    }
    
    // MARCAR API COMO EXITOSA (RESETEAR CONTADORES)
    static markAsSuccessful(keyId: string, keyData: any): void {
        const statusMap = this.loadAPIStatus();
        const now = Date.now();
        
        const status: APIKeyStatus = statusMap.get(keyId) || {
            id: keyId,
            api_key: keyData.api_key,
            projectName: keyData.projectName,
            status: 'active',
            failureCount: 0
        };
        
        // RESETEAR SI ERA TEMPORAL
        if (status.status === 'quota_exhausted' || status.status === 'daily_limit') {
            status.status = 'active';
            status.failureCount = 0;
            console.log(`✅ API ${keyData.projectName} reactivada después de éxito`);
        }
        
        status.lastUsedAt = now;
        statusMap.set(keyId, status);
        this.saveAPIStatus(statusMap);
    }
    
    // OBTENER SIGUIENTE HORA DE RESET (MEDIANOCHE PST)
    private static getNextResetTime(): number {
        const now = new Date();
        const pst = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
        const nextMidnight = new Date(pst);
        nextMidnight.setDate(pst.getDate() + 1);
        nextMidnight.setHours(0, 5, 0, 0); // 00:05 PST para dar margen
        
        return nextMidnight.getTime();
    }
    
    // OBTENER ESTADÍSTICAS
    static getStats(): {
        total: number;
        active: number;
        quotaExhausted: number;
        dailyLimit: number;
        permanentlyBlocked: number;
    } {
        const statusMap = this.loadAPIStatus();
        let activeKeysCount = 0;
        
        // We need to count the total keys from the source, and then categorize from statusMap
        const allKeys = new Set(Array.from(statusMap.values()).map(s => s.id));
        
        const stats = {
            total: allKeys.size,
            active: 0,
            quotaExhausted: 0,
            dailyLimit: 0,
            permanentlyBlocked: 0
        };
        
        statusMap.forEach(status => {
            switch (status.status) {
                case 'active':
                    stats.active++;
                    break;
                case 'quota_exhausted':
                    stats.quotaExhausted++;
                    break;
                case 'daily_limit':
                    stats.dailyLimit++;
                    break;
                case 'permanently_blocked':
                    stats.permanentlyBlocked++;
                    break;
            }
        });
        
        // Keys that are not in the status map are considered active.
        // This is a proxy since we don't have the full key list here.
        // A better approach would pass the full key list to getStats.
        // For now, this is a reasonable approximation.
        // Let's assume the rotator provides the full list context.
        const knownKeys = statusMap.size;
        
        return stats;
    }
    
    // RESETEAR TODAS LAS APIS (EMERGENCIA)
    static resetAllAPIs(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🔄 TODAS LAS APIs RESETEADAS - Estado limpio');
    }
    
    // LISTAR ESTADO DE TODAS LAS APIS
    static listAPIStatus(): APIKeyStatus[] {
        const statusMap = this.loadAPIStatus();
        return Array.from(statusMap.values()).sort((a, b) => {
            // Ordenar por estado: activas primero, luego por proyecto
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (b.status === 'active' && a.status !== 'active') return 1;
            return a.projectName.localeCompare(b.projectName);
        });
    }
}

export { PersistentAPIKeyManager };