/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// ============================================================================
// 📝 SERVICIO DE LOGGING UNIVERSAL
// ============================================================================
// Este servicio centraliza todos los logs de la aplicación.
// - Captura automáticamente console.log, console.warn, console.error.
// - Captura errores de JavaScript no manejados.
// - Persiste los logs en localStorage.
// - Mantiene un buffer de los últimos 1000 logs.
// - Permite que los componentes de React se suscriban a las actualizaciones.
// ============================================================================

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  details?: any;
}

// Función segura para convertir objetos a JSON, manejando estructuras circulares
const safeJsonStringify = (obj: any): string => {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular Reference]';
      }
      cache.add(value);
    }
    return value;
  }, 2);
};

class LoggerService {
  private logs: LogEntry[] = [];
  private subscribers: Set<(logs: LogEntry[]) => void> = new Set();
  private readonly MAX_LOGS = 1000;
  private readonly STORAGE_KEY = 'app_universal_logs';
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  constructor() {
    this.load();
  }
  
  public init(): void {
    this.overrideConsole();
    this.listenForGlobalErrors();
  }
  
  private overrideConsole(): void {
    console.log = (...args: any[]) => this.log('INFO', 'Console', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), args);
    console.warn = (...args: any[]) => this.log('WARNING', 'Console', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), args);
    console.error = (...args: any[]) => this.log('ERROR', 'Console', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), args);
    console.debug = (...args: any[]) => this.log('DEBUG', 'Console', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), args);
  }

  private listenForGlobalErrors(): void {
    window.addEventListener('error', (event) => {
      this.log('ERROR', 'Global', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error,
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      this.log('ERROR', 'Global', 'Unhandled Promise Rejection', { reason: event.reason?.stack || event.reason });
    });
  }

  public log(level: LogLevel, component: string, message: string, details?: any): void {
    this.originalConsole.log(`[${level}] (${component}) ${message}`, details || '');
    
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      component,
      message,
      details: details ? safeJsonStringify(details) : undefined,
    };

    this.logs.push(newLog);

    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
    
    this.save();
    this.notifySubscribers();

    if(level === 'ERROR') {
      // Logic to auto-open the log viewer can be handled by subscribers
    }
  }
  
  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.add(callback);
    // Immediately notify with current logs
    callback(this.logs);
    
    return () => this.subscribers.delete(callback);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback([...this.logs]));
  }

  private save(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, safeJsonStringify(this.logs));
    } catch (e) {
      this.originalConsole.error('Failed to save logs to localStorage:', e);
    }
  }

  private load(): void {
    try {
      const storedLogs = localStorage.getItem(this.STORAGE_KEY);
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (e) {
      this.originalConsole.error('Failed to load logs from localStorage:', e);
      this.logs = [];
    }
  }
  
  public clear(): void {
    this.logs = [];
    this.save();
    this.notifySubscribers();
    this.log('INFO', 'Logger', 'Logs cleared by user.');
  }
}

export const logger = new LoggerService();
