/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';

interface LogPanelProps {
  logs: string[];
  onClear: () => void;
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom when new logs are added
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full bg-gray-900/70 border border-gray-700 rounded-lg p-4 flex flex-col gap-2 animate-fade-in backdrop-blur-sm mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-300">Registro de Proceso</h3>
        <button
          onClick={onClear}
          className="bg-white/10 hover:bg-white/20 text-gray-300 font-semibold py-1 px-3 rounded-md text-sm transition-colors"
        >
          Limpiar
        </button>
      </div>
      <div
        ref={logContainerRef}
        className="h-32 bg-black/50 rounded-md p-2 overflow-y-auto font-mono text-xs text-gray-400"
      >
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;