export class IframeGeminiManager {
  private iframe: HTMLIFrameElement | null = null;
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.iframe) {
      this.cleanup();
    }

    return new Promise((resolve, reject) => {
      this.iframe = document.createElement('iframe');
      this.iframe.style.display = 'none';
      // FIX: Use `setAttribute` to set the iframe's sandbox attribute, as the `sandbox` property is read-only.
      this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      
      this.iframe.onload = () => {
        try {
          const iframeWindow = this.iframe!.contentWindow!;
          
          const script = `
            window.geminiCall = async function(apiKey, model, requestBody) {
              try {
                const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody),
                  credentials: 'omit',
                  mode: 'cors'
                });
                
                if (!response.ok) {
                  const errorBody = await response.json();
                  throw new Error(\`HTTP \${response.status}: \${errorBody?.error?.message || response.statusText}\`);
                }
                
                return await response.json();
              } catch (error) {
                throw new Error(error.message);
              }
            };
          `;
          
          const scriptEl = iframeWindow.document.createElement('script');
          scriptEl.textContent = script;
          iframeWindow.document.body.appendChild(scriptEl);
          
          this.isReady = true;
          console.log('✅ IframeGeminiManager initialized');
          resolve();
        } catch (error) {
          console.error('❌ Failed to initialize iframe:', error);
          reject(error);
        }
      };
      
      this.iframe.onerror = (error) => {
        console.error('❌ Iframe load error:', error);
        reject(error);
      };
      
      document.body.appendChild(this.iframe);
      // Setting src after appending to body can help in some browsers
      this.iframe.src = 'about:blank';
    });
  }

  async generateContent(apiKey: string, model: string, requestBody: any): Promise<any> {
    if (!this.isReady || !this.iframe || !this.iframe.contentWindow) {
      await this.initialize();
    }

    const iframeWindow = this.iframe!.contentWindow as any;
    
    try {
      iframeWindow.requestPayload = requestBody;
      const result = await iframeWindow.eval(`
        (async () => {
          return await window.geminiCall("${apiKey}", "${model}", window.requestPayload);
        })()
      `);
      return result;
    } catch (error: any) {
      throw new Error(`Iframe call failed: ${error.message}`);
    } finally {
        if(iframeWindow) {
            delete iframeWindow.requestPayload;
        }
    }
  }

  cleanup(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
    this.isReady = false;
  }
}

// Instancia global
export const iframeGemini = new IframeGeminiManager();