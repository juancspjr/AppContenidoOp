/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `GenerateImagesResponse` to correctly type the output of the image generation method.
// FIX: Removed `VideosOperationResponse` as it is not an exported member of `@google/genai`.
import { GoogleGenAI, GenerateContentResponse, GenerateImagesResponse } from '@google/genai';
import { logger } from '../utils/logger';
import { formatApiError } from '../utils/errorUtils';

// NOTE: The API key is managed by the environment and is a hard requirement.
// The app must not ask the user for it.
if (!process.env.API_KEY) {
    // This is a developer error, not a user error.
    const errorMsg = "API_KEY environment variable is not set. This is a mandatory requirement.";
    logger.log('ERROR', 'GeminiService', errorMsg);
    throw new Error(errorMsg);
}

class GeminiService {
    private ai: GoogleGenAI;
    private requestQueue: (() => Promise<any>)[] = [];
    private isProcessing = false;

    constructor() {
        try {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             logger.log('SUCCESS', 'GeminiService', 'GoogleGenAI client initialized successfully.');
        } catch (e) {
            const errorMsg = formatApiError(e);
            logger.log('ERROR', 'GeminiService', 'Failed to initialize GoogleGenAI client.', errorMsg);
            throw new Error(`Failed to initialize GoogleGenAI client: ${errorMsg}`);
        }
    }
    
    private enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push(() => requestFn().then(resolve).catch(reject));
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        const request = this.requestQueue.shift();
        if (request) {
            try {
                await request();
            } catch (error) {
                logger.log('ERROR', 'GeminiService', 'Request failed in queue', error);
            } finally {
                // Add a delay between requests to respect rate limits
                setTimeout(() => {
                    this.isProcessing = false;
                    this.processQueue();
                }, 1000); // 1-second delay
            }
        } else {
             this.isProcessing = false;
        }
    }
    
    private async makeApiRequestWithRetry<T>(
        apiCall: () => Promise<T>,
        retries = 3
    ): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await apiCall();
            } catch (error: unknown) {
                const errorMessage = formatApiError(error);
                logger.log('WARNING', 'GeminiService', `API call attempt ${i+1} failed.`, { error: errorMessage });
                if (i === retries - 1) {
                    logger.log('ERROR', 'GeminiService', `API call failed after ${retries} attempts.`);
                    throw error;
                }
                // Exponential backoff
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
            }
        }
        // This part should be unreachable
        throw new Error("API request failed after all retries.");
    }
    
    public async generateContent(
        request: Omit<Parameters<typeof this.ai.models.generateContent>[0], 'model'>,
        modelName: string = 'gemini-2.5-flash'
    ): Promise<GenerateContentResponse> {
        logger.log('INFO', 'GeminiService', `Enqueuing generateContent request for model: ${modelName}`);
        
        // Make a mutable copy of the request to add model-specific configs
        const finalRequest: any = { ...request };

        // Automatically manage thinkingBudget for gemini-2.5-flash when maxOutputTokens is set.
        if (modelName.includes('gemini-2.5-flash') && finalRequest.config?.maxOutputTokens) {
            // Ensure config and thinkingConfig objects exist
            if (!finalRequest.config) finalRequest.config = {};
            if (!finalRequest.config.thinkingConfig) finalRequest.config.thinkingConfig = {};
            
            // Reserve a portion for thinking (e.g., 1024 tokens) if not already set.
            // This prevents all tokens from being consumed by thinking, which would result in an empty response.
            if (finalRequest.config.thinkingConfig.thinkingBudget === undefined) {
                finalRequest.config.thinkingConfig.thinkingBudget = 1024;
                logger.log('DEBUG', 'GeminiService', `Auto-setting thinkingBudget for gemini-2.5-flash with maxOutputTokens.`);
            }
        }
        
        return this.enqueue(() => this.makeApiRequestWithRetry(() => {
            logger.log('DEBUG', 'GeminiService', 'Executing generateContent request', { request: finalRequest, model: modelName });
            return this.ai.models.generateContent({ ...finalRequest, model: modelName });
        }));
    }
    
    public async generateContentStream(
        request: Omit<Parameters<typeof this.ai.models.generateContentStream>[0], 'model'>,
        modelName: string = 'gemini-2.5-flash'
    ) {
        // Note: Streaming requests are not enqueued or retried in the same way as unary requests.
        // The consumer of the stream is responsible for handling the lifecycle.
        logger.log('DEBUG', 'GeminiService', `Executing generateContentStream request for model: ${modelName}`, { request });
        try {
            return this.ai.models.generateContentStream({ ...request, model: modelName });
        } catch (error) {
            const errorMessage = formatApiError(error);
            logger.log('ERROR', 'GeminiService', 'generateContentStream call failed immediately.', { error: errorMessage });
            throw error;
        }
    }

    public async generateImages(
         request: Omit<Parameters<typeof this.ai.models.generateImages>[0], 'model'>,
        // FIX: Update the default image generation model to the one specified in the guidelines.
         modelName: string = 'imagen-4.0-generate-001'
    // FIX: Add a specific return type to ensure type safety in calling functions.
    ): Promise<GenerateImagesResponse> {
        logger.log('INFO', 'GeminiService', `Enqueuing generateImages request for model: ${modelName}`);
        return this.enqueue(() => this.makeApiRequestWithRetry(() => {
            logger.log('DEBUG', 'GeminiService', 'Executing generateImages request', { request, model: modelName });
            return this.ai.models.generateImages({ ...request, model: modelName });
        }));
    }
    
    // FIX: Removed explicit return type annotation to allow TypeScript to infer the correct SDK operation type.
    public async generateVideos(
         request: Omit<Parameters<typeof this.ai.models.generateVideos>[0], 'model'>
    ) {
        logger.log('INFO', 'GeminiService', 'Enqueuing generateVideos request...');
        return this.enqueue(() => this.makeApiRequestWithRetry(() => {
            logger.log('DEBUG', 'GeminiService', 'Executing generateVideos request', { request });
            return this.ai.models.generateVideos({ ...request, model: 'veo-2.0-generate-001' });
        }));
    }
    
    // FIX: Removed explicit return type annotation to allow TypeScript to infer the correct SDK operation type.
    public async getVideosOperation(
        request: Parameters<typeof this.ai.operations.getVideosOperation>[0]
    ) {
        logger.log('INFO', 'GeminiService', 'Enqueuing getVideosOperation request...');
         return this.enqueue(() => this.makeApiRequestWithRetry(() => {
            logger.log('DEBUG', 'GeminiService', 'Executing getVideosOperation request', { name: request.operation.name });
            return this.ai.operations.getVideosOperation(request);
        }));
    }
}

export const geminiService = new GeminiService();