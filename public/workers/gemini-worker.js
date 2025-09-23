self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  if (type === 'GEMINI_REQUEST') {
    const { apiKey, model, requestBody, requestId } = data;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`HTTP ${response.status}: ${errorBody?.error?.message || response.statusText}`);
      }
      
      const result = await response.json();
      
      self.postMessage({
        type: 'SUCCESS',
        requestId,
        data: result
      });
      
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        requestId,
        error: error.message
      });
    }
  }
});

console.log('🔧 Gemini Worker initialized');