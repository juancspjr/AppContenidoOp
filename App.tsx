/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import EditorCanvas from './components/EditorCanvas';
import StoryBuilder from './components/StoryBuilder';
// FIX: Corrected import path for story-builder types to be relative from the current file, ensuring module resolution.
import type { StoryMasterplan, ExportedProject } from './components/story-builder/types';
import { projectPersistenceService } from './services/projectPersistenceService';
import { logger } from './utils/logger';

type AppState = 
  | { view: 'start' }
  | { view: 'photo_editor', files: File[] }
  // FIX: Corrected project type to `ExportedProject` to ensure type consistency.
  | { view: 'story_builder', project?: ExportedProject };

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({ view: 'start' });

  const handleStartPhotoEditor = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      setAppState({ view: 'photo_editor', files: Array.from(files) });
    }
  }, []);

  const handleStartStoryBuilder = useCallback(() => {
    setAppState({ view: 'story_builder' });
  }, []);

  // FIX: Corrected project type to `ExportedProject` to match the expected data structure from import/load.
  const handleProjectImport = useCallback((project: ExportedProject) => {
    setAppState({ view: 'story_builder', project });
  }, []);
  
  const handleExitToStart = useCallback(async () => {
      if (appState.view === 'story_builder') {
          // Add confirmation dialog for critical action
          const shouldExit = window.confirm("¿Estás seguro de que quieres salir? El progreso no guardado en un archivo se perderá.");
          if (shouldExit) {
              try {
                // We keep indexedDB assets but clear the session project
                projectPersistenceService.clearSavedProject();
                logger.log('INFO', 'App', 'Project session cleared on exit.');
              } catch (err) {
                logger.log('ERROR', 'App', 'Failed to clear project session on exit', err);
              }
              setAppState({ view: 'start' });
          }
      } else {
         setAppState({ view: 'start' });
      }
  }, [appState.view]);
  
  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {appState.view === 'start' && (
        <div className="flex items-center justify-center min-h-screen">
            <StartScreen 
                onStartPhotoEditor={handleStartPhotoEditor} 
                onStartStoryBuilder={handleStartStoryBuilder}
                onProjectImport={handleProjectImport}
            />
        </div>
      )}
      {appState.view === 'photo_editor' && (
        <EditorCanvas initialFiles={appState.files} onExit={handleExitToStart} />
      )}
      {appState.view === 'story_builder' && (
        <StoryBuilder 
          existingProject={appState.project} 
          onExit={handleExitToStart}
        />
      )}
    </div>
  );
};

export default App;