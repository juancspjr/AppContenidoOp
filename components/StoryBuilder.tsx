/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect } from 'react';
// FIX: Added missing imports from geminiService
import { generateStoryFromPrompt, runFinalVideoGenerationPipeline, generateAllDocumentation, generateCritique, regenerateStoryPlanWithCritique, generateOptimizedReferenceAssets, cancelCurrentGeneration, generateHybridNeuralSceneFrame, downloadProjectLocally } from '@/services/geminiService';
import type { StoryData, CharacterData, ProgressUpdate, StoryMasterplan, FinalAssets, Documentation, Critique, GeneratedReferenceAssets, ReferenceAsset, ExportedProject, ExportedReferenceAsset, ExportedGeneratedReferenceAssets, Scene } from '@/components/story-builder/types';
import { outputFormats, narrativeStyles, visualStyles, narrativeStructures, hookTypes, conflictTypes, endingTypes } from '@/components/story-builder/constants';
import Spinner from '@/components/Spinner';
import { UploadIcon, XCircleIcon, DocumentIcon, DownloadIcon } from '@/components/icons';
import AssetGenerationView from '@/components/story-builder/AssetGenerationView';
import RefinementPhaseView from '@/components/story-builder/RefinementPhaseView';
import EvaluationPhaseView from '@/components/story-builder/EvaluationPhaseView';
import ReferenceAssetView from '@/components/story-builder/ReferenceAssetView';
import { imageBlobCache } from '@/services/imageBlobCache';
import { projectPersistenceService } from '@/services/projectPersistenceService';
import { assetDBService } from '@/services/assetDBService';
import APIStatusPanel from '@/components/story-builder/APIStatusPanel';


interface StoryBuilderProps {
  onExit: () => void;
  importedProject: StoryMasterplan | ExportedProject | null;
}

type ContextImage = {
    id: string;
    file: File;
    previewUrl: string;
};

const ProgressTracker: React.FC<{ phase: string, data: StoryData, plan: StoryMasterplan | null }> = ({ phase, data, plan }) => {
    const phases = [
        { id: '1', name: 'Concepto' },
        { id: '2', name: 'Estilo y Energía' },
        { id: '3', name: 'Personajes' },
        { id: '4', name: 'Estructura' },
        { id: '5', name: 'Plan de Historia (JSON)' },
        { id: '6.1', name: 'Evaluación y Estrategia' },
        { id: '6.2', name: 'Documentación y Refinamiento' },
        { id: '6.3', name: 'Activos de Referencia' },
        { id: '6.4', name: 'Generación de Videos' },
    ];

    const getStatus = (p: string) => {
        const numericPhase = parseFloat(phase);
        const numericP = parseFloat(p);
        if (numericP < numericPhase) return '✅ Completado';
        if (p === phase) return '🔄 En Proceso';
        return '⏳ Pendiente';
    };

    return (
        <div className="w-full lg:w-96 bg-gray-900/50 border border-gray-700/80 rounded-lg p-6 flex-shrink-0 self-start">
            <h2 className="text-xl font-bold text-center text-blue-300 mb-4">🎬 Story Builder - Progreso</h2>
            <ul className="space-y-3 mb-6">
                {phases.map(p => (
                    <li key={p.id} className={`p-2 rounded-md transition-all ${p.id === phase ? 'bg-blue-500/20' : ''}`}>
                        <span className="font-semibold">{`FASE ${p.id}: ${p.name}`}</span>
                        <span className="block text-sm text-gray-400">{getStatus(p.id)}</span>
                    </li>
                ))}
            </ul>
            <div className="border-t border-gray-700 pt-4">
                 <h3 className="text-lg font-bold text-gray-200 mb-2">📝 Tu Historia Hasta Ahora:</h3>
                 <div className="space-y-2 text-sm text-gray-400 max-h-48 overflow-y-auto pr-2">
                    {plan?.metadata.title ? <div><strong>Título:</strong> {plan.metadata.title}</div> : data.concept && <div><strong>Concepto:</strong> {data.concept}</div>}
                    {data.format && <div><strong>Formato:</strong> {Object.values(outputFormats).flat().find(f => f.value === data.format)?.name || data.format}</div>}
                    {data.storyPDF && <div><strong>PDF:</strong> {data.storyPDF.name}</div>}
                    {data.contextImages.length > 0 && <div><strong>Imágenes Contexto:</strong> {data.contextImages.length}</div>}
                    {data.narrativeStyles.length > 0 && <div><strong>Estilos Narrativos:</strong> {data.narrativeStyles.join(', ')}</div>}
                    {data.visualStyles.length > 0 && <div><strong>Estilos Visuales:</strong> {data.visualStyles.join(', ')}</div>}
                    {data.narrativeStructure.length > 0 && <div><strong>Estructuras:</strong> {data.narrativeStructure.join(', ')}</div>}
                    {data.hook.length > 0 && <div><strong>Ganchos:</strong> {data.hook.join(', ')}</div>}
                    {data.conflict.length > 0 && <div><strong>Conflictos:</strong> {data.conflict.join(', ')}</div>}
                    {data.ending.length > 0 && <div><strong>Finales:</strong> {data.ending.join(', ')}</div>}
                    {parseFloat(phase) > 1 && <div><strong>Energía:</strong> Nivel {data.energyLevel}/10</div>}
                 </div>
            </div>
        </div>
    );
};

interface MultiSelectGridProps {
    title: string;
    categories: Record<string, { name: string; description: string }[]>;
    selectedItems: string[];
    onToggle: (item: string) => void;
    maxSelection: number;
    helpText: string;
}

const MultiSelectGrid: React.FC<MultiSelectGridProps> = ({ title, categories, selectedItems, onToggle, maxSelection, helpText }) => {
    return (
        <div>
            <p className="font-semibold mb-2">{title} <span className="text-gray-400 font-normal">(máximo {maxSelection})</span></p>
             <p className="text-sm text-gray-400 mb-3">{helpText}</p>
            <div className="max-h-60 overflow-y-auto pr-2 border border-gray-700/50 rounded-lg p-2 bg-black/20">
                {Object.entries(categories).map(([categoryName, items]) => (
                    <div key={categoryName} className="mb-3">
                        <h5 className="font-bold text-blue-300 text-sm mb-2 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1">{categoryName}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {items.map(item => (
                                <button
                                    key={item.name}
                                    onClick={() => onToggle(item.name)}
                                    title={item.description}
                                    className={`p-2 text-xs rounded-md transition-colors h-full text-left ${selectedItems.includes(item.name) ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

type GenerationStatus = 'pending' | 'in_progress' | 'complete' | 'error';
interface GenerationProgress {
    plan: GenerationStatus;
    critique: GenerationStatus;
    docs: GenerationStatus;
}

const StoryBuilder: React.FC<StoryBuilderProps> = ({ onExit, importedProject }) => {
  const [phase, setPhase] = useState<string>('1');
  const [storyData, setStoryData] = useState<StoryData>({
    concept: '', format: 'tiktok_vertical', narrativeStyles: [], energyLevel: 5, visualStyles: [],
    storyPDF: null, contextImages: [], characters: [{id: crypto.randomUUID(), name: '', description: '', image: null }],
    narrativeStructure: [], hook: [], conflict: [], ending: [],
  });
  const [contextImages, setContextImages] = useState<ContextImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 5+ state
  const [generatedStoryPlan, setGeneratedStoryPlan] = useState<StoryMasterplan | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({ plan: 'pending', critique: 'pending', docs: 'pending' });
  const [critique, setCritique] = useState<Critique | null>(null);
  const [documentation, setDocumentation] = useState<Documentation | null>(null);
  const [referenceAssets, setReferenceAssets] = useState<GeneratedReferenceAssets | null>(null);
  const [referenceAssetAspectRatio, setReferenceAssetAspectRatio] = useState<ReferenceAsset['aspectRatio']>('9:16');
  const [loadingScenes, setLoadingScenes] = useState<Record<string, boolean>>({});
  const [assetGenerationUIProgress, setAssetGenerationUIProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);


  // Phase 6.4 state
  const [assetGenerationProgress, setAssetGenerationProgress] = useState<Record<string, ProgressUpdate>>({});
  const [finalAssets, setFinalAssets] = useState<FinalAssets | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  
  const updateData = (key: keyof StoryData, value: any) => {
    setStoryData(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const handleImport = async () => {
        if (!importedProject) return;
        
        // This handles both file imports and local storage loads
        if ('plan' in importedProject && 'assets' in importedProject) {
            setIsLoading(true);
            setError(null);
            const exported = importedProject as ExportedProject;
            try {
                // 1. Set metadata
                setGeneratedStoryPlan(exported.plan);
                setDocumentation(exported.documentation);
                setCritique(exported.critique);

                // 2. Differentiate loading strategy based on presence of imageData
                const firstAsset = exported.assets.characters[0] || exported.assets.environments[0] || exported.assets.elements[0] || exported.assets.sceneFrames[0];
                const isFileImport = !!firstAsset?.imageData;

                const loadAssets = async (exportedAssets: ExportedReferenceAsset[]): Promise<ReferenceAsset[]> => {
                    return Promise.all(exportedAssets.map(async asset => {
                        const { imageData, ...rest } = asset;
                        let blob: Blob | null = null;
                        
                        if (isFileImport && imageData) {
                            // File import: convert base64 to blob
                            const res = await fetch(imageData);
                            blob = await res.blob();
                        } else {
                            // Local storage import: load blob from IndexedDB
                            blob = await assetDBService.loadAsset(asset.id);
                        }
                        
                        if (blob) {
                            imageBlobCache.set(asset.id, blob);
                        } else {
                            console.warn(`Could not load blob for asset ${asset.id}`);
                        }
                        return rest as ReferenceAsset;
                    }));
                };
                
                const restoredAssets: GeneratedReferenceAssets = {
                    characters: await loadAssets(exported.assets.characters),
                    environments: await loadAssets(exported.assets.environments),
                    elements: await loadAssets(exported.assets.elements),
                    sceneFrames: await loadAssets(exported.assets.sceneFrames),
                };
                
                setReferenceAssets(restoredAssets);
                setPhase('6.3');

            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al procesar el archivo del proyecto.";
                setError(msg);
                setPhase('1'); // Fallback to start on error
            } finally {
                setIsLoading(false);
            }
        } 
        // Old, plan-only import (keep for backward compatibility)
        else if ('metadata' in importedProject) {
            setIsLoading(true);
            setPhase('5');
            setGeneratedStoryPlan(importedProject as StoryMasterplan);
            try {
                const [docs, crit] = await Promise.all([
                    generateAllDocumentation(importedProject as StoryMasterplan),
                    generateCritique(importedProject as StoryMasterplan, storyData),
                ]);
                setDocumentation(docs);
                setCritique(crit);
                setPhase('6.1');
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al procesar el proyecto importado.";
                setError(msg);
                setPhase('1'); // Fallback to start on error
            } finally {
                setIsLoading(false);
            }
        }
    };
    handleImport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedProject]);

  useEffect(() => {
    // This cleanup hook handles temporary preview URLs for user-uploaded images.
    // The main imageBlobCache is cleared explicitly on component unmount.
    return () => {
        storyData.characters.forEach(char => {
            if (char.imagePreviewUrl) {
                URL.revokeObjectURL(char.imagePreviewUrl);
            }
        });
        contextImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, [storyData.characters, contextImages]);

  useEffect(() => {
    // Clear the entire blob cache when the StoryBuilder is unmounted (e.g., user exits).
    // This is crucial for releasing memory between sessions.
    return () => {
        imageBlobCache.clear();
    };
  }, []);

  const createMultiSelectToggle = (field: keyof StoryData, max: number) => (item: string) => {
    const currentItems = storyData[field] as string[];
    if (currentItems.includes(item)) {
        updateData(field, currentItems.filter(i => i !== item));
    } else if (currentItems.length < max) {
        updateData(field, [...currentItems, item]);
    }
  };

  const toggleNarrativeStyle = createMultiSelectToggle('narrativeStyles', 3);
  const toggleVisualStyle = createMultiSelectToggle('visualStyles', 5);
  const toggleNarrativeStructure = createMultiSelectToggle('narrativeStructure', 3);
  const toggleHook = createMultiSelectToggle('hook', 5);
  const toggleConflict = createMultiSelectToggle('conflict', 10);
  const toggleEnding = createMultiSelectToggle('ending', 5);


  const updateCharacter = (id: string, field: keyof CharacterData, value: any) => {
    const newCharacters = storyData.characters.map(char => {
      if (char.id === id) {
        // Create a preview URL for the image for UI display
        if (field === 'image' && value instanceof File) {
            if (char.imagePreviewUrl) URL.revokeObjectURL(char.imagePreviewUrl);
            const imagePreviewUrl = URL.createObjectURL(value);
            return { ...char, image: value, imagePreviewUrl };
        }
        return { ...char, [field]: value };
      }
      return char;
    });
    updateData('characters', newCharacters);
  };

  const addCharacter = () => {
    if (storyData.characters.length < 5) {
        const newCharacter: CharacterData = { id: crypto.randomUUID(), name: '', description: '', image: null };
        updateData('characters', [...storyData.characters, newCharacter]);
    }
  };
  
  const removeCharacter = (id: string) => {
    const charToRemove = storyData.characters.find(c => c.id === id);
    if(charToRemove?.imagePreviewUrl) URL.revokeObjectURL(charToRemove.imagePreviewUrl);
    updateData('characters', storyData.characters.filter(char => char.id !== id));
  };
  
  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        updateData('storyPDF', e.target.files[0]);
    }
  };

  const handleContextImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const newContextImages: ContextImage[] = filesArray.map(file => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      setContextImages(prev => [...prev, ...newContextImages]);
      updateData('contextImages', [...storyData.contextImages, ...filesArray]);
    }
  };

  const removeContextImage = (idToRemove: string) => {
    const imageToRemove = contextImages.find(img => img.id === idToRemove);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.previewUrl);
      setContextImages(prev => prev.filter(img => img.id !== idToRemove));
      updateData('contextImages', storyData.contextImages.filter(file => file !== imageToRemove.file));
    }
  };

  const canGoToPhase2 = useMemo(() => (storyData.concept.trim().length > 5 || storyData.storyPDF) && storyData.format, [storyData.concept, storyData.format, storyData.storyPDF]);
  const canGoToPhase3 = useMemo(() => storyData.narrativeStyles.length > 0 && storyData.visualStyles.length > 0, [storyData.narrativeStyles, storyData.visualStyles]);
  const canGoToPhase4 = useMemo(() => storyData.characters.every(c => c.name.trim().length > 0 && c.description.trim().length > 0), [storyData.characters]);
  const canGoToPhase5 = useMemo(() => storyData.narrativeStructure.length > 0 && storyData.hook.length > 0 && storyData.conflict.length > 0 && storyData.ending.length > 0, [storyData]);

  const handleGenerateStoryPlan = async () => {
    setIsLoading(true);
    setError(null);
    setPhase('5');
    setGenerationProgress({ plan: 'in_progress', critique: 'pending', docs: 'pending' });

    try {
        console.log('%c🚀 MODO QUOTA-SAFE: Generando plan sin análisis de imágenes', 'color: lightblue; font-weight: bold;');
        console.log('%c💡 Las imágenes se analizarán en Fase 6.3 para generar activos visuales', 'color: cyan;');

        const plan = await generateStoryFromPrompt(storyData);
        setGeneratedStoryPlan(plan);
        setGenerationProgress(prev => ({ ...prev, plan: 'complete', critique: 'in_progress' }));

        const crit = await generateCritique(plan, storyData);
        setCritique(crit);
        setGenerationProgress(prev => ({ ...prev, critique: 'complete', docs: 'in_progress' }));

        const docs = await generateAllDocumentation(plan);
        setDocumentation(docs);
        setGenerationProgress(prev => ({ ...prev, docs: 'complete' }));
        
        console.log('%c✅ Plan maestro generado con quota preservada para Fase 6.3', 'color: lightgreen; font-weight: bold;');
        
        setTimeout(() => {
            setPhase('6.1');
        }, 1000);

    } catch(err) {
        const msg = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
        console.error('%c❌ Error en Fase 5:', 'color: red; font-weight: bold;', err);
        
        // 🔥 MANEJO ESPECÍFICO DE QUOTA EXCEEDED
        if (msg.includes('daily limit') || msg.includes('quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
            setError(`🚨 LÍMITE DIARIO DE API ALCANZADO

La Fase 5 consume muchas llamadas API para la arquitectura neuronal. Opciones:

1. ⏰ ESPERAR: Las quotas se resetean a medianoche PST (en ${Math.abs(new Date().getHours() - 24)} horas)

2. 🔑 USAR OTRA API KEY: Si tienes más cuentas de Google AI Studio

3. 📤 CONTINUAR MANUALMENTE: Salta la Fase 5 y sube tus propios assets en Fase 6.3

4. 💰 UPGRADE: Considera Gemini Pro para límites más altos

El sistema está diseñado para preservar quota, pero la arquitectura neuronal requiere múltiples análisis.`);
        } else {
            setError(msg);
        }

        setGenerationProgress({ plan: 'error', critique: 'error', docs: 'error' });
        setPhase('4');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleApplyImprovements = async () => {
    if (!generatedStoryPlan || !critique) return;
    setIsLoading(true);
    setError(null);
    
    const onProgress = (phase: string, message: string) => {
        console.log(`🔄 Regeneración Fase ${phase}: ${message}`);
        // Optional: Update UI with visual progress
    };
    
    try {
        console.log('🚀 Aplicando mejoras con Arquitectura Neuronal...');
        
        const newPlan = await regenerateStoryPlanWithCritique(generatedStoryPlan, critique, onProgress);
        setGeneratedStoryPlan(newPlan);
        
        const newDocs = await generateAllDocumentation(newPlan);
        setDocumentation(newDocs);
        
        setPhase('6.2');
        console.log('✅ Mejoras aplicadas con éxito');
        
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al regenerar el plan.";
        setError(msg);
        console.error('❌ Error aplicando mejoras:', err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleCancelGeneration = () => {
    console.log("Solicitando cancelación de la generación de activos...");
    cancelCurrentGeneration();
  };
  
  const handleGenerateReferenceAssets = async (aspectRatio: ReferenceAsset['aspectRatio']) => {
    if (!generatedStoryPlan || !documentation) return;
    setPhase('6.3');
    setIsLoading(true);
    setError(null);
    setAssetGenerationUIProgress(null);
    
    try {
        console.log('🚀 Iniciando generación optimizada de activos...');
        
        const onProgress = (current: number, total: number, message: string) => {
            setAssetGenerationUIProgress({ current, total, message });
        };
        
        const assets = await generateOptimizedReferenceAssets(
            generatedStoryPlan,
            storyData,
            aspectRatio,
            onProgress
        );
        
        setReferenceAssets({ ...assets, sceneFrames: [] });
        setAssetGenerationUIProgress(null);
        console.log('✅ Generación de activos completada');
        
    } catch (err: any) {
        if (err.message?.includes("cancelled by user")) {
            setError("La generación de activos fue cancelada por el usuario.");
            console.log("🚫 Proceso de generación cancelado.");
        } else {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido en generación';
            setError(errorMessage);
            console.error('❌ Error en generación de activos:', err);
        }
        setAssetGenerationUIProgress(null);
    } finally {
        setIsLoading(false);
    }
};

const handleGenerateFrameForScene = async (scene: Scene, frameType: 'start' | 'climax' | 'end') => {
    if (!generatedStoryPlan || !documentation || !referenceAssets) return;
    
    const loadingKey = `${scene.scene_number}-${frameType}`;
    setLoadingScenes(prev => ({ ...prev, [loadingKey]: true }));
    setError(null);
    
    try {
        const onProgress = (message: string) => {
            console.log(`🎬 Progreso Escena ${scene.scene_number} (${frameType}): ${message}`);
        };
        
        const newFrame = await generateHybridNeuralSceneFrame(
            generatedStoryPlan, 
            scene, 
            referenceAssets, 
            referenceAssetAspectRatio,
            frameType,
            storyData,
            onProgress
        );
        
        setReferenceAssets(prev => {
            if (!prev) return null;
            return {
                ...prev,
                sceneFrames: [...prev.sceneFrames, newFrame],
            };
        });
        
        console.log(`✅ Fotograma '${frameType}' generado para Escena ${scene.scene_number}`);
        
    } catch (err) {
        const msg = err instanceof Error ? err.message : `Error al generar fotograma para la escena ${scene.scene_number}.`;
        setError(msg);
        console.error(`❌ Error en Escena ${scene.scene_number} (${frameType}):`, err);
    } finally {
        setLoadingScenes(prev => ({ ...prev, [loadingKey]: false }));
    }
};


  const handleStartFinalVideoGeneration = async () => {
      if (!generatedStoryPlan || !referenceAssets || !documentation) {
          setError("No hay un plan, guía de IA o activos de referencia para generar los videos.");
          return;
      }
      setPhase('6.4');
      setIsLoading(true);
      setError(null);
      setAssetGenerationProgress({});
      setFinalAssets(null);
      
      const onProgress = (update: ProgressUpdate) => {
          const key = update.stage === 'videos' && update.sceneId ? `video_${update.sceneId}` : update.stage;
          setAssetGenerationProgress(prev => ({...prev, [key]: update}));
      };

      try {
          const assets = await runFinalVideoGenerationPipeline(generatedStoryPlan, referenceAssets, documentation.aiProductionGuide, onProgress);
          setFinalAssets(assets);
      } catch (err) {
          const msg = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
          setError(msg);
      } finally {
          setIsLoading(false);
      }
  };

  const handleRegenerateAssets = (aspectRatio: ReferenceAsset['aspectRatio']) => {
      if (generatedStoryPlan && documentation) {
          handleGenerateReferenceAssets(aspectRatio);
      }
  };

  const handleUpdateAsset = (assetId: string, instruction: string) => {
    if (!referenceAssets) return;
    
    const update = (assets: ReferenceAsset[]) => assets.map(a => a.id === assetId ? { ...a, instruction } : a);

    setReferenceAssets({
        characters: update(referenceAssets.characters),
        environments: update(referenceAssets.environments),
        elements: update(referenceAssets.elements),
        sceneFrames: update(referenceAssets.sceneFrames),
    });
  };

  const handleDeleteAsset = (assetId: string) => {
      if (!referenceAssets) return;
      
      imageBlobCache.remove(assetId);

      setReferenceAssets(prev => {
          if (!prev) return null;
          return {
              characters: prev.characters.filter(a => a.id !== assetId),
              environments: prev.environments.filter(a => a.id !== assetId),
              elements: prev.elements.filter(a => a.id !== assetId),
              sceneFrames: prev.sceneFrames.filter(a => a.id !== assetId),
          };
      });
  };

  const handleUploadAsset = (type: 'character' | 'environment' | 'element', file: File) => {
      const newAsset: ReferenceAsset = {
          id: crypto.randomUUID(),
          name: file.name.split('.').slice(0, -1).join('.'),
          type,
          prompt: `User uploaded file: ${file.name}`,
          source: 'user',
          instruction: '',
          aspectRatio: '9:16' // default
      };
      
      imageBlobCache.set(newAsset.id, file);

      setReferenceAssets(prev => {
          const newAssets = prev ? { ...prev } : { characters: [], environments: [], elements: [], sceneFrames: [] };
          if (type === 'character') newAssets.characters.push(newAsset);
          else if (type === 'environment') newAssets.environments.push(newAsset);
          else if (type === 'element') newAssets.elements.push(newAsset);
          return newAssets;
      });
  };

  const handleExportProject = async () => {
    if (!generatedStoryPlan || !documentation || !referenceAssets) {
        setError("Faltan datos para exportar el proyecto. Asegúrate de haber generado el plan y los activos.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        await downloadProjectLocally(
            generatedStoryPlan,
            documentation,
            referenceAssets,
            critique
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al exportar el proyecto.";
        setError(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveProjectLocally = async () => {
    if (!generatedStoryPlan || !documentation || !critique || !referenceAssets) {
        setError("Faltan datos para guardar el proyecto. Asegúrate de haber generado el plan y los activos.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        // 1. Prepare asset metadata for localStorage (without binary data)
        const convertAssetsForMetadata = (assets: ReferenceAsset[]): ExportedReferenceAsset[] => {
            return assets.map(asset => {
                const { url, ...rest } = (asset as any); // url is temporary, don't save
                return { ...rest }; // No imageData property
            });
        };

        const metadataAssets: ExportedGeneratedReferenceAssets = {
            characters: convertAssetsForMetadata(referenceAssets.characters),
            environments: convertAssetsForMetadata(referenceAssets.environments),
            elements: convertAssetsForMetadata(referenceAssets.elements),
            sceneFrames: convertAssetsForMetadata(referenceAssets.sceneFrames),
        };

        const projectToSave: ExportedProject = {
            plan: generatedStoryPlan,
            documentation,
            critique,
            assets: metadataAssets,
        };
        
        // 2. Save metadata to localStorage
        projectPersistenceService.saveProject(projectToSave);

        // 3. Save binary blobs to IndexedDB
        const allAssets = [
            ...referenceAssets.characters, 
            ...referenceAssets.environments,
            ...referenceAssets.elements,
            ...referenceAssets.sceneFrames
        ];
        
        await Promise.all(allAssets.map(asset => {
            const blob = imageBlobCache.get(asset.id);
            if (blob) {
                return assetDBService.saveAsset(asset.id, blob);
            }
            return Promise.resolve();
        }));

        alert('¡Proyecto guardado localmente en tu navegador!');

    } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al guardar el proyecto localmente.";
        setError(msg);
        alert(`Error al guardar: ${msg}`);
    } finally {
        setIsLoading(false);
    }
  };
  
  const GenerationProgressItem: React.FC<{ status: GenerationStatus; label: string }> = ({ status, label }) => {
    const statusMap = {
        pending: { icon: '⏳', color: 'text-gray-400' },
        in_progress: { icon: <div className="w-5 h-5"><Spinner /></div>, color: 'text-blue-300' },
        complete: { icon: '✅', color: 'text-green-400' },
        error: { icon: '❌', color: 'text-red-400' },
    };
    const current = statusMap[status];

    return (
        <li className={`flex items-center gap-4 p-3 rounded-lg transition-colors duration-300 ${status === 'in_progress' ? 'bg-blue-500/10' : 'bg-gray-900/20'}`}>
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{current.icon}</div>
            <span className={`font-semibold ${current.color}`}>{label}</span>
        </li>
    );
};

  const renderPhase = () => {
    if (error && parseFloat(phase) < 6.3) {
        return (
            <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                <h3 className="font-bold text-lg mb-2">Error en la Generación</h3>
                <p className="whitespace-pre-wrap">{error}</p>
                <button 
                    onClick={() => setError(null)} 
                    className="mt-4 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg"
                >
                    Intentar de Nuevo
                </button>
            </div>
        )
    }

    if (isLoading && parseFloat(phase) < 5) {
        return (
            <div className="text-center py-8">
                <Spinner />
                <p className="text-gray-400 mt-4">Procesando...</p>
            </div>
        );
    }

    switch(phase) {
        case '1': return (
            <>
                <h3 className="text-2xl font-bold mb-2">Fase 1: Concepto Básico</h3>
                <p className="text-gray-400 mb-6">Empecemos con lo básico. Describe tu idea, sube un documento o proporciona imágenes de referencia.</p>
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                    <textarea value={storyData.concept} onChange={e => updateData('concept', e.target.value)} rows={3} placeholder="Descríbeme tu idea de historia en 2-3 frases..." className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3" />
                    
                    <div className="text-center text-gray-400 font-bold">O</div>

                    <label className="w-full flex flex-col items-center justify-center p-4 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 hover:border-gray-500">
                        <DocumentIcon className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="font-semibold text-gray-300">Sube un PDF con la historia</span>
                        {storyData.storyPDF && <span className="text-sm text-blue-400 mt-1">{storyData.storyPDF.name}</span>}
                        <input type="file" className="hidden" accept=".pdf" onChange={handlePDFUpload} />
                    </label>

                     <div>
                        <label className="font-semibold block mb-2">Sube imágenes de contexto (opcional)</label>
                        <label className="w-full flex flex-col items-center justify-center p-4 bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 hover:border-gray-500">
                            <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="font-semibold text-gray-300">Arrastra o selecciona imágenes</span>
                             <input type="file" className="hidden" multiple accept="image/*" onChange={handleContextImageUpload} />
                        </label>
                        {contextImages.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {contextImages.map((image) => (
                                    <div key={image.id} className="relative group">
                                        <img src={image.previewUrl} alt="Context preview" className="w-full h-24 object-cover rounded-lg" />
                                        <button onClick={() => removeContextImage(image.id)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="font-semibold mb-2">¿Qué formato final quieres?</p>
                        <div className="max-h-60 overflow-y-auto pr-2 border border-gray-700/50 rounded-lg p-2 bg-black/20">
                            {Object.entries(outputFormats).map(([categoryName, items]) => (
                                <div key={categoryName} className="mb-3">
                                    <h5 className="font-bold text-blue-300 text-sm mb-2 sticky top-0 bg-gray-900/80 backdrop-blur-sm py-1">{categoryName}</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {items.map(f => (
                                            <button 
                                                key={f.value} 
                                                onClick={() => updateData('format', f.value)} 
                                                title={f.description}
                                                className={`p-3 text-sm rounded-md transition-colors text-left ${storyData.format === f.value ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20'}`}>{f.name}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button onClick={() => setPhase('2')} disabled={!canGoToPhase2} className="w-full mt-8 bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600 transition-colors">Siguiente: Estilo y Energía</button>
            </>
        );
        case '2': return (
            <>
                <h3 className="text-2xl font-bold mb-2">Fase 2: Estilo y Energía</h3>
                <p className="text-gray-400 mb-6">Ahora, definamos la atmósfera de tu historia.</p>
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                    <MultiSelectGrid
                        title="¿Qué estilo narrativo prefieres?"
                        categories={narrativeStyles}
                        selectedItems={storyData.narrativeStyles}
                        onToggle={toggleNarrativeStyle}
                        maxSelection={3}
                        helpText="Selecciona los géneros o tonos que definirán tu historia."
                    />
                    <div>
                        <p className="font-semibold mb-2">Nivel de energía (1=Calmado, 10=Caótico)</p>
                        <div className="flex items-center gap-4">
                            <input type="range" min="1" max="10" value={storyData.energyLevel} onChange={e => updateData('energyLevel', Number(e.target.value))} className="w-full" />
                            <span className="font-bold text-lg text-blue-300">{storyData.energyLevel}</span>
                        </div>
                    </div>
                    <MultiSelectGrid
                        title="¿Qué estilo visual prefieres?"
                        categories={visualStyles}
                        selectedItems={storyData.visualStyles}
                        onToggle={toggleVisualStyle}
                        maxSelection={5}
                        helpText="Elige la estética visual. Puedes combinar estilos para crear un look único."
                    />
                </div>
                <button onClick={() => setPhase('3')} disabled={!canGoToPhase3} className="w-full mt-8 bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600 transition-colors">Siguiente: Personajes</button>
            </>
        );
        case '3': return (
             <>
                <h3 className="text-2xl font-bold mb-2">Fase 3: Personajes Clave</h3>
                <p className="text-gray-400 mb-6">¿Quiénes protagonizan esta historia? Sube una imagen de referencia para cada uno (recomendado).</p>
                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                    {storyData.characters.map((char, index) => (
                        <div key={char.id} className="bg-gray-800 border border-gray-600 rounded-lg p-4 flex gap-4 items-start relative">
                            <div className="flex-grow space-y-3">
                                <input type="text" value={char.name} onChange={e => updateCharacter(char.id, 'name', e.target.value)} placeholder={`Nombre del Personaje ${index + 1}`} className="w-full bg-gray-700 border border-gray-500 rounded-md p-2" />
                                <textarea value={char.description} onChange={e => updateCharacter(char.id, 'description', e.target.value)} rows={3} placeholder="Descripción breve del personaje (apariencia, personalidad, rol en la historia)" className="w-full bg-gray-700 border border-gray-500 rounded-md p-2 text-sm" />
                            </div>
                            <label className="w-24 h-24 flex-shrink-0 bg-gray-700 rounded-lg border-2 border-dashed border-gray-500 cursor-pointer flex items-center justify-center hover:bg-gray-600 hover:border-gray-400 relative">
                                {char.imagePreviewUrl ? (
                                    <img src={char.imagePreviewUrl} alt="preview" className="w-full h-full object-cover rounded-lg"/>
                                ) : (
                                    <UploadIcon className="w-8 h-8 text-gray-400" />
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={e => updateCharacter(char.id, 'image', e.target.files?.[0])} />
                            </label>
                            {storyData.characters.length > 1 && (
                                <button onClick={() => removeCharacter(char.id)} className="text-gray-400 hover:text-white absolute top-2 right-2">
                                    <XCircleIcon className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                    ))}
                    {storyData.characters.length < 5 && (
                        <button onClick={addCharacter} className="w-full border-2 border-dashed border-gray-600 text-gray-400 py-2 rounded-lg hover:bg-gray-700 hover:border-gray-500">
                            + Añadir Personaje
                        </button>
                    )}
                </div>
                <button onClick={() => setPhase('4')} disabled={!canGoToPhase4} className="w-full mt-8 bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600 transition-colors">Siguiente: Estructura</button>
            </>
        );
        case '4': return (
            <>
                <h3 className="text-2xl font-bold mb-2">Fase 4: Estructura y Ritmo</h3>
                <p className="text-gray-400 mb-6">Define los pilares de tu narrativa para crear una experiencia cautivadora.</p>
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                    <MultiSelectGrid title="Estructura Narrativa" categories={{ "Estructuras Narrativas": narrativeStructures }} selectedItems={storyData.narrativeStructure} onToggle={toggleNarrativeStructure} maxSelection={3} helpText="Elige el esqueleto de tu historia." />
                    <MultiSelectGrid title="Gancho Inicial (Hook)" categories={hookTypes} selectedItems={storyData.hook} onToggle={toggleHook} maxSelection={5} helpText="¿Cómo capturarás la atención en los primeros 3 segundos?" />
                    <MultiSelectGrid title="Conflicto Central" categories={conflictTypes} selectedItems={storyData.conflict} onToggle={toggleConflict} maxSelection={10} helpText="¿Cuál es el motor de la historia? Elige los tipos de conflicto que enfrentarán los personajes." />
                    <MultiSelectGrid title="Tipo de Final" categories={endingTypes} selectedItems={storyData.ending} onToggle={toggleEnding} maxSelection={5} helpText="¿Cómo quieres que termine la historia y qué emoción dejará en la audiencia?" />
                </div>
                <button onClick={handleGenerateStoryPlan} disabled={!canGoToPhase5 || isLoading} className="w-full mt-8 bg-green-600 text-white font-bold py-3 rounded-lg disabled:bg-gray-600 transition-colors">
                    {isLoading ? 'Generando...' : 'Generar Plan de Historia con IA'}
                </button>
            </>
        );
        case '5': return (
            <>
                <h3 className="text-2xl font-bold mb-2 text-blue-300">Fase 5: Generando Plan Maestro...</h3>
                <p className="text-gray-400 mb-6">Nuestros agentes de IA están colaborando para construir tu plan de historia. Este proceso puede tardar un momento.</p>
                <div className="space-y-3">
                    <GenerationProgressItem status={generationProgress.plan} label="Generando el StoryMasterplan JSON..." />
                    <GenerationProgressItem status={generationProgress.critique} label="Realizando análisis estratégico y crítica..." />
                    <GenerationProgressItem status={generationProgress.docs} label="Escribiendo documentación de producción..." />
                </div>
                {error && (
                     <div className="mt-4 text-center text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20">
                        <h3 className="font-bold text-lg mb-2">Error en la Generación</h3>
                        <p className="whitespace-pre-wrap">{error}</p>
                     </div>
                )}
            </>
        );
        case '6.1': return (
            <EvaluationPhaseView
                critique={critique}
                isLoading={isLoading}
                onApplyImprovements={handleApplyImprovements}
                onContinue={() => setPhase('6.2')}
                onGoToPhase={(p) => setPhase(p.toString())}
            />
        );
        case '6.2': return (
            <RefinementPhaseView
                storyPlan={generatedStoryPlan}
                documentation={documentation}
                onStartReferenceGeneration={() => handleGenerateReferenceAssets(referenceAssetAspectRatio)}
            />
        );
        case '6.3': return (
            <ReferenceAssetView
                storyPlan={generatedStoryPlan}
                isLoading={isLoading}
                loadingScenes={loadingScenes}
                assets={referenceAssets}
                error={error}
                generationProgress={assetGenerationUIProgress}
                onContinue={handleStartFinalVideoGeneration}
                onRegenerate={handleRegenerateAssets}
                onGenerateFrameForScene={handleGenerateFrameForScene}
                onUpdateAsset={handleUpdateAsset}
                onDeleteAsset={handleDeleteAsset}
                onUploadAsset={handleUploadAsset}
                aspectRatio={referenceAssetAspectRatio}
                setAspectRatio={setReferenceAssetAspectRatio}
                onExportProject={handleExportProject}
                onSaveLocally={handleSaveProjectLocally}
                onCancelGeneration={handleCancelGeneration}
            />
        );
        case '6.4': return (
            <AssetGenerationView
                isLoading={isLoading}
                progress={assetGenerationProgress}
                assets={finalAssets}
                error={error}
                storyPlan={generatedStoryPlan}
                onRegenerate={handleStartFinalVideoGeneration}
                onGoToPhase={(p) => setPhase(p.toString())}
            />
        );
        default: return <div>Fase desconocida: {phase}</div>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:flex-1 bg-gray-800/80 border border-gray-700/80 rounded-lg p-6 backdrop-blur-sm">
                {renderPhase()}
            </div>
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
        </div>
         <div className="mt-6 flex justify-center gap-4 flex-col items-center">
            <button onClick={onExit} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg">Salir del Story Builder</button>
             <div className="w-full max-w-2xl mt-4">
                <button onClick={() => setShowDevTools(prev => !prev)} className="text-sm text-gray-400 hover:text-white w-full py-2 bg-gray-900/50 rounded-t-lg border-x border-t border-gray-700">
                    {showDevTools ? '▼ Ocultar Herramientas de Desarrollador' : '▶ Mostrar Herramientas de Desarrollador'}
                </button>
                {showDevTools && (
                    <div className="animate-fade-in">
                         <APIStatusPanel />
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default StoryBuilder;