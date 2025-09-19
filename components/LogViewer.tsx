/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppLogs } from '../hooks/useAppLogs';
import { type LogEntry, type LogLevel } from '../utils/logger';
import { CopyIcon, ExportIcon, XCircleIcon } from './icons';

interface LogViewerProps {
  isVisible: boolean;
  onClose: () => void;
}

const levelConfig: Record<LogLevel, { color: string; bg: string }> = {
  INFO: { color: 'text-blue-300', bg: 'bg-blue-900/50' },
  SUCCESS: { color: 'text-green-300', bg: 'bg-green-900/50' },
  WARNING: { color: 'text-yellow-300', bg: 'bg-yellow-900/50' },
  ERROR: { color: 'text-red-300', bg: 'bg-red-900/50' },
  DEBUG: { color: 'text-purple-300', bg: 'bg-purple-900/50' },
};

const LogViewer: React.FC<LogViewerProps> = ({ isVisible, onClose }) => {
  const { logs, clearLogs } = useAppLogs();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(new Set(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'DEBUG']));
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const allComponents = useMemo(() => {
    const components = new Set(logs.map(log => log.component));
    return Array.from(components).sort();
  }, [logs]);
  
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const term = searchTerm.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(term);
      const levelMatch = selectedLevels.has(log.level);
      const componentMatch = selectedComponents.size === 0 || selectedComponents.has(log.component);
      return messageMatch && levelMatch && componentMatch;
    });
  }, [logs, searchTerm, selectedLevels, selectedComponents]);

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) newSet.delete(level);
      else newSet.add(level);
      return newSet;
    });
  };

  const toggleComponent = (component: string) => {
    setSelectedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(component)) newSet.delete(component);
      else newSet.add(component);
      return newSet;
    });
  };

  const formatLogsToString = (logsToFormat: LogEntry[]) => {
    return logsToFormat.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      let details = '';
      if (log.details) {
        try {
          details = JSON.stringify(JSON.parse(log.details), null, 2);
        } catch {
          details = log.details;
        }
      }
      return `[${timestamp}] [${log.level}] [${log.component}] ${log.message}${details ? `\n--- DETAILS ---\n${details}\n--- END DETAILS ---` : ''}`;
    }).join('\n\n');
  };

  const handleCopy = (filtered: boolean) => {
    const logsToCopy = filtered ? filteredLogs : logs;
    navigator.clipboard.writeText(formatLogsToString(logsToCopy));
  };
  
  const handleExport = () => {
    const json = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">📝 Visor de Logs Universal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircleIcon className="w-7 h-7" />
          </button>
        </header>

        {/* Filters */}
        <div className="p-3 border-b border-gray-700 flex-shrink-0 space-y-2">
          <input
            type="text"
            placeholder="Buscar en logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.keys(levelConfig).map(level => (
              <button
                key={level}
                onClick={() => toggleLevel(level as LogLevel)}
                className={`px-2 py-1 rounded ${selectedLevels.has(level as LogLevel) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
              >{level}</button>
            ))}
          </div>
           {allComponents.length > 0 && <details className="text-xs">
              <summary className="cursor-pointer text-gray-400">Filtrar por Componente</summary>
              <div className="flex flex-wrap gap-2 pt-2">
                {allComponents.map(comp => (
                  <button
                    key={comp}
                    onClick={() => toggleComponent(comp)}
                    className={`px-2 py-1 rounded ${selectedComponents.has(comp) ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >{comp}</button>
                ))}
              </div>
            </details>}
        </div>

        {/* Log Display */}
        <div ref={logContainerRef} className="flex-grow overflow-y-auto p-3 font-mono text-xs">
          {filteredLogs.map(log => (
            <div key={log.id} className={`p-1.5 rounded mb-1 whitespace-pre-wrap ${levelConfig[log.level].bg}`}>
              <span className="text-gray-500 mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`font-bold mr-2 ${levelConfig[log.level].color}`}>{log.level}</span>
              <span className="text-purple-300 mr-2">[{log.component}]</span>
              <span className="text-gray-200">{log.message}</span>
              {log.details && (
                <details className="mt-1 ml-4 cursor-pointer">
                  <summary className="text-gray-500 text-xs">Ver detalles</summary>
                  <pre className="bg-black/50 p-2 rounded mt-1 text-gray-400">{log.details}</pre>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-gray-700 flex-shrink-0 flex flex-wrap gap-2 justify-end">
          <button onClick={() => handleCopy(true)} className="flex items-center gap-1 text-xs bg-gray-700 px-3 py-2 rounded hover:bg-gray-600"><CopyIcon className="w-4 h-4" /> Copiar Filtrados</button>
          <button onClick={() => handleCopy(false)} className="flex items-center gap-1 text-xs bg-gray-700 px-3 py-2 rounded hover:bg-gray-600"><CopyIcon className="w-4 h-4" /> Copiar Todo</button>
          <button onClick={handleExport} className="flex items-center gap-1 text-xs bg-gray-700 px-3 py-2 rounded hover:bg-gray-600"><ExportIcon className="w-4 h-4"/> Exportar a JSON</button>
          <button onClick={clearLogs} className="flex items-center gap-1 text-xs bg-red-800 px-3 py-2 rounded hover:bg-red-700 text-red-200"><XCircleIcon className="w-4 h-4"/> Limpiar</button>
        </footer>
      </div>
    </div>
  );
};

export default LogViewer;