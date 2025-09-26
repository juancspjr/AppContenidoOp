/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
class APIRateLimiter {
    private callQueue: Array<() => Promise<any>> = [];
    private isProcessing = false;
    private lastCallTime = 0;
    private minInterval = 2000; // 2 segundos entre llamadas para free tier
    
    async addCall<T>(apiCall: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.callQueue.push(async () => {
                try {
                    const result = await apiCall();
                    resolve(result);
                } catch (error) {
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