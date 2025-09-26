/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { logger } from '../utils/logger';

interface CacheEntry {
    data: any;
    timestamp: number;
    hash: string;
    expiresAt: number;
}

class CacheService {
    private cache = new Map<string, CacheEntry>();
    private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutos

    // FIX: Make generateHash public so it can be used by other services to create cache keys.
    public generateHash(input: any): string {
        try {
            const str = JSON.stringify(input);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0; // Convert to 32bit integer
            }
            return hash.toString(16);
        } catch {
            return `fallback-${Date.now()}`;
        }
    }

    public set(key: string, data: any, ttl?: number): void {
        const expiresAt = Date.now() + (ttl || this.DEFAULT_TTL);
        const hash = this.generateHash(data);
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            hash,
            expiresAt
        });

        logger.log('DEBUG', 'CacheService', `💾 Cached entry: ${key}`, { hash, expiresAt });
    }
    
    private peek(key: string): CacheEntry | undefined {
        return this.cache.get(key);
    }

    public get(key: string): any | null {
        const entry = this.peek(key);
        
        if (!entry) {
            return null;
        }
        
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            logger.log('DEBUG', 'CacheService', `🗑️ Cache expired: ${key}`);
            return null;
        }

        logger.log('DEBUG', 'CacheService', `📦 Cache hit: ${key}`, { age: Date.now() - entry.timestamp });
        return entry.data;
    }

    public shouldUpdate(key: string, newInput: any): boolean {
        const entry = this.peek(key);
        if (!entry || Date.now() > entry.expiresAt) return true;

        const newHash = this.generateHash(newInput);
        return entry.hash !== newHash;
    }

    public clear(pattern?: string): void {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
        logger.log('INFO', 'CacheService', 'Cache cleared.');
    }
}

export const cacheService = new CacheService();