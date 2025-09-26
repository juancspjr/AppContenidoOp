/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadIcon, MagicWandIcon, PaletteIcon, SunIcon, BookOpenIcon, DownloadIcon, XCircleIcon } from './icons';
import type { ExportedProject } from './story-builder/types';
import { projectPersistenceService } from '../services/projectPersistenceService';
import { logger } from '../utils/logger';

interface StartScreenProps {
  onStartPhotoEditor: (files: FileList | null) => void;
  onStartStoryBuilder: () => void;
  onProjectImport: (project: ExportedProject) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStartPhotoEditor, onStartStoryBuilder, onProjectImport }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const importProjectInputRef = useRef<HTMLInputElement>(null);
  const [hasLocalSave, setHasLocalSave] = useState(false);

  useEffect(() => {
    setHasLocalSave(projectPersistenceService.hasSavedProject());
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStartPhotoEditor(e.target.files);
  };
  
  const handleImportProjectClick = () => {
    importProjectInputRef.current?.click();
  };

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target?.result as string) as ExportedProject;
          if (projectData && (projectData.storyPlan || projectData.plan)) { // Legacy support for 'plan'
             const finalProject: ExportedProject = {
               ...projectData,
               storyPlan: projectData.storyPlan || projectData.plan,
             };
             onProjectImport(finalProject);
          } else {
             throw new Error("Invalid project file structure.");
          }
        } catch (error) {
          logger.log('ERROR', 'StartScreen', 'Failed to parse project file', error);
          alert("The project file is invalid or corrupt.");
        }
      };
      reader.readAsText(file);
    }
    if(e.target) e.target.value = '';
  };
  
  const handleLoadLocalProject = useCallback(() => {
    const loadedProject = projectPersistenceService.loadProject();
    if (loadedProject) {
      logger.log('INFO', 'StartScreen', 'Loading project from local save.');
      onProjectImport(loadedProject);
    } else {
      alert("Could not load the saved project. It might be corrupt or was cleared.");
      projectPersistenceService.clearSavedProject();
      setHasLocalSave(false);
    }
  }, [onProjectImport]);

  const handleClearLocalProject = useCallback(() => {
      if (window.confirm("Are you sure you want to delete the locally saved project? This action cannot be undone.")) {
          try {
            projectPersistenceService.clearSavedProject();
            setHasLocalSave(false);
            logger.log('INFO', 'StartScreen', 'Local project cleared by user.');
            alert("Local project deleted.");
          } catch (err) {
            logger.log('ERROR', 'StartScreen', 'Failed to clear local project', err);
            alert("Error deleting local project.");
          }
      }
  }, []);

  return (
    <div 
      className={`w-full max-w-5xl mx-auto text-center p-8 transition-all duration-300 rounded-2xl border-2 ${isDraggingOver ? 'bg-blue-500/10 border-dashed border-blue-400' : 'border-transparent'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onStartPhotoEditor(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-100 sm:text-6xl md:text-7xl">
          Edición de Fotos y Creación de Historias <span className="text-blue-400">con IA</span>
        </h1>
        <p className="max-w-3xl text-lg text-gray-400 md:text-xl">
          Construye historias virales o edita tus fotos a un nivel profesional. Todo guiado y mejorado por nuestros agentes de IA.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6">
            <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-blue-600 rounded-full cursor-pointer group hover:bg-blue-500 transition-colors">
                <UploadIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
                Editar una Imagen
            </label>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            
            <button onClick={onStartStoryBuilder} className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-100 bg-gray-700/50 border border-gray-600 rounded-full cursor-pointer group hover:bg-gray-700 transition-colors">
                 <BookOpenIcon className="w-6 h-6 mr-3 transition-transform duration-300 ease-in-out group-hover:scale-110" />
                Construir una Historia
            </button>
            <button onClick={handleImportProjectClick} className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-gray-100 bg-gray-700/50 border border-gray-600 rounded-full cursor-pointer group hover:bg-gray-700 transition-colors">
                 <UploadIcon className="w-6 h-6 mr-3 transition-transform duration-300 ease-in-out group-hover:scale-110" />
                Importar Proyecto
            </button>
            <input id="project-import-start" ref={importProjectInputRef} type="file" className="hidden" accept=".json" onChange={handleProjectFileChange} />
        </div>
        
        {hasLocalSave && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-500/30 rounded-lg flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
              <div className="text-left">
                  <h3 className="font-bold text-green-300">¡Tienes un proyecto guardado!</h3>
                  <p className="text-sm text-green-400/80">Continúa donde lo dejaste.</p>
              </div>
              <button onClick={handleLoadLocalProject} className="w-full sm:w-auto relative inline-flex items-center justify-center px-6 py-3 text-base font-bold text-white bg-green-600 rounded-full cursor-pointer group hover:bg-green-500 transition-colors">
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Cargar Proyecto Guardado
              </button>
              <button onClick={handleClearLocalProject} title="Borrar proyecto guardado localmente" className="p-2 text-gray-400 hover:text-white hover:bg-red-500/50 rounded-full transition-colors">
                  <XCircleIcon className="w-6 h-6" />
              </button>
          </div>
        )}
        
        <p className="text-sm text-gray-500">Sube una imagen para editar, empieza una nueva historia o importa un proyecto existente</p>

        <div className="mt-16 w-full">
            <h2 className="text-3xl font-bold text-center mb-8">Un Conjunto de Herramientas Creativas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <MagicWandIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Retoque Preciso</h3>
                    <p className="mt-2 text-gray-400">Pinta sobre cualquier área para eliminar objetos, cambiar colores o añadir elementos con gran precisión.</p>
                </div>
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <PaletteIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Filtros Creativos</h3>
                    <p className="mt-2 text-gray-400">Transforma fotos con estilos artísticos. Desde looks vintage a brillos futuristas, encuentra o crea el filtro perfecto.</p>
                </div>
                <div className="bg-black/20 p-6 rounded-lg border border-gray-700/50 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-full mb-4">
                       <SunIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-100">Ajustes Profesionales</h3>
                    <p className="mt-2 text-gray-400">Ajusta la luz, el color y la atmósfera para lograr el look perfecto con herramientas de nivel profesional.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
