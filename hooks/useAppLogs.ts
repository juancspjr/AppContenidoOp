/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState, useEffect } from 'react';
import { logger, type LogEntry } from '../utils/logger';

export const useAppLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());

  useEffect(() => {
    // Subscribe to the logger service and update the state whenever new logs arrive.
    const unsubscribe = logger.subscribe(setLogs);
    
    // Cleanup subscription on component unmount.
    return () => unsubscribe();
  }, []);

  return {
    logs,
    addLog: logger.log.bind(logger),
    clearLogs: logger.clear.bind(logger),
  };
};