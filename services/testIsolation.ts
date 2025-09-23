import { workerGemini } from './workerGeminiManager';
import { iframeGemini } from './iframeGeminiManager';
import { logger } from '../utils/logger';

export async function testIsolationMethods() {
    const testApiKey = process.env.API_KEY;
    if (!testApiKey) {
        logger.log('ERROR', 'IsolationTest', 'API_KEY not found in environment for testing.');
        return;
    }
    const testPrompt = 'Hello, this is a test prompt';
    const requestBody = { contents: [{ parts: [{ text: testPrompt }] }] };
    const model = 'gemini-2.5-flash';
    
    logger.log('INFO', 'IsolationTest', '🧪 Testing isolation methods...');
    
    // Test Worker
    try {
        logger.log('INFO', 'IsolationTest', 'Testing Worker...');
        const workerResult = await workerGemini.generateContent(testApiKey, model, requestBody);
        if (workerResult?.candidates) {
            logger.log('SUCCESS', 'IsolationTest', '✅ Worker successful:', workerResult);
        } else {
            throw new Error(workerResult.error || 'Worker returned invalid response');
        }
    } catch (error) {
        logger.log('ERROR', 'IsolationTest', '❌ Worker failed:', error);
    }
    
    // Test Iframe
    try {
        logger.log('INFO', 'IsolationTest', 'Testing Iframe...');
        await iframeGemini.initialize();
        const iframeResult = await iframeGemini.generateContent(testApiKey, model, requestBody);
        if (iframeResult?.candidates) {
            logger.log('SUCCESS', 'IsolationTest', '✅ Iframe successful:', iframeResult);
        } else {
            throw new Error(iframeResult.error || 'Iframe returned invalid response');
        }
    } catch (error) {
        logger.log('ERROR', 'IsolationTest', '❌ Iframe failed:', error);
    }
    
    logger.log('INFO', 'IsolationTest', '🧪 Isolation tests completed');
}
