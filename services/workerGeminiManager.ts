export class WorkerGeminiManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {resolve: Function, reject: Function}>();
  private isInitialized = false;
  private initializationPromise: Promise<void>;
  private objectURL: string | null = null;

  constructor() {
    this.initializationPromise = this.initWorker();
  }

  private async initWorker(): Promise<void> {
    try {
      const response = await fetch('/workers/gemini-worker.js');
      if (!response.ok) {
        throw new Error(`Failed to fetch worker script: ${response.statusText}`);
      }
      const workerScript = await response.text();
      
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.objectURL = URL.createObjectURL(blob);

      this.worker = new Worker(this.objectURL);
      
      this.worker.onmessage = (event) => {
        const { type, requestId, data, error } = event.data;
        const pending = this.pendingRequests.get(requestId);
        
        if (pending) {
          if (type === 'SUCCESS') {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error));
          }
          this.pendingRequests.delete(requestId);
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('🚨 Worker error:', error);
        this.isInitialized = false;
      };
      
      this.isInitialized = true;
      console.log('✅ WorkerGeminiManager initialized from Blob');
    } catch (error) {
      console.error('❌ Failed to initialize worker:', error);
      this.isInitialized = false;
      throw error; // Re-throw to make the initialization promise reject
    }
  }

  async generateContent(apiKey: string, model: string, requestBody: any): Promise<any> {
    try {
        await this.initializationPromise;
    } catch (initError) {
        // Initialization failed, so we can't proceed.
        throw new Error('Worker failed to initialize.');
    }

    if (!this.isInitialized || !this.worker) {
      // This case should be covered by the await above, but as a safeguard.
      throw new Error('Worker not initialized.');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36)}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.worker!.postMessage({
        type: 'GEMINI_REQUEST',
        data: { apiKey, model, requestBody, requestId }
      });
      
      // Timeout 30 segundos
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.objectURL) {
        URL.revokeObjectURL(this.objectURL);
        this.objectURL = null;
    }
    this.pendingRequests.clear();
    this.isInitialized = false;
  }
}

// Instancia global
export const workerGemini = new WorkerGeminiManager();