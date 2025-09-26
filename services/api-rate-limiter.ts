/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { logger } from '../utils/logger';
import { formatApiError } from '../utils/errorUtils';

class APIRateLimiter {
    private callQueue: Array<() => Promise<any>> = [];
    private isProcessing = false;
    private lastCallTime = 0;
    private minInterval = 2000; // 2 segundos entre llamadas para free tier
    
    async addCall<T>(apiCall: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.callQueue.push(async () => {
                const waitTime = Date.now() - startTime;
                if (waitTime > 1000) {
                    logger.log('DEBUG', 'RateLimiter', `⏱️ Request esperó ${waitTime}ms en cola`);
                }
                try {
                    const result = await apiCall();
                    logger.log('DEBUG', 'RateLimiter', '✅ API call completada exitosamente');
                    resolve(result);
                } catch (error) {
                    logger.log('WARNING', 'RateLimiter', '⚠️ API call falló', { error: formatApiError(error) });
                    reject(error);
                }
            });
            
            this.processQueue();
        });
    }
    
    private async processQueue() {
        if (this.isProcessing || this.callQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.callQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastCall = now - this.lastCallTime;
            
            if (timeSinceLastCall < this.minInterval) {
                await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
            }
            
            const call = this.callQueue.shift();
            if (call) {
                this.lastCallTime = Date.now();
                await call();
            }
        }
        
        this.isProcessing = false;
    }
}

export const apiRateLimiter = new APIRateLimiter();