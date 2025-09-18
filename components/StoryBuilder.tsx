/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect } from 'react';
// FIX: Added missing import for `generateAdvancedStoryPlan` from geminiService.
import { generateStoryFromPrompt, runFinalVideoGenerationPipeline, generateAllDocumentation, generateCritique, regenerateStoryPlanWithCritique, generateOptimizedReferenceAssets, cancelCurrentGeneration, generateHybridNeuralSceneFrame, downloadProjectLocally, generateCharacterWithReference, generateAdvancedStoryPlan, generateReferenceAssetsPhase63 } from '@/services/geminiService';
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
import GeminiWebLogin from './story-builder/GeminiWebLogin';


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
                    {plan?.metadata?.title ? <div><strong>Título:</strong> {plan?.metadata?.title}</div> : data.concept && <div><strong>Concepto:</strong> {data.concept}</div>}
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

  const handleAutoGeneratePhase63 = async () => {
    if (!generatedStoryPlan) return;
    setIsLoading(true);
    setError(null);
    try {
        const newAssets = await generateReferenceAssetsPhase63(
            generatedStoryPlan,
            storyData,
            referenceAssetAspectRatio,
            (current, total, message) => {
                setAssetGenerationUIProgress({ current, total, message });
            }
        );
        // Merge new assets with any existing ones (e.g., user-uploaded)
        setReferenceAssets(prev => ({
            characters: [...(prev?.characters || []), ...newAssets.characters],
            environments: [...(prev?.environments || []), ...newAssets.environments],
            elements: [...(prev?.elements || []), ...newAssets.elements],
            sceneFrames: prev?.sceneFrames || [],
        }));
    } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido durante la auto-generación.");
    } finally {
        setIsLoading(false);
        setAssetGenerationUIProgress(null);
    }
  };
  
  useEffect(() => {
    const shouldAutoGenerate = phase === '6.3' && 
                               !isLoading && 
                               generatedStoryPlan &&
                               (!referenceAssets || (referenceAssets.characters.length === 0 && referenceAssets.environments.length === 0));
    if (shouldAutoGenerate) {
        handleAutoGeneratePhase63();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isLoading, generatedStoryPlan, referenceAssets]);


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
            return { ...char, [field]: value, imagePreviewUrl };
        }
        if (field === 'image' && value === null) {
            if (char.imagePreviewUrl) URL.revokeObjectURL(char.imagePreviewUrl);
            return { ...char, image: null, imagePreviewUrl: undefined };
        }
        return { ...char, [field]: value };
      }
      return char;
    });
    updateData('characters', newCharacters);
  };

  const addCharacter = () => {
    if(storyData.characters.length < 5){
       updateData('characters', [...storyData.characters, {id: crypto.randomUUID(), name: '', description: '', image: null }]);
    }
  };

  const removeCharacter = (id: string) => {
    const charToRemove = storyData.characters.find(c => c.id === id);
    if (charToRemove?.imagePreviewUrl) URL.revokeObjectURL(charToRemove.imagePreviewUrl);
    updateData('characters', storyData.characters.filter(char => char.id !== id));
  };
  
  const handleNextPhase = async () => {
    const currentPhaseNum = parseFloat(phase);
    
    if (currentPhaseNum === 4) {
        setIsLoading(true);
        setError(null);
        setGenerationProgress({ plan: 'in_progress', critique: 'pending', docs: 'pending' });
        try {
            const { plan: newPlan } = await generateAdvancedStoryPlan(storyData);
            if (!newPlan || !newPlan.metadata || !newPlan.metadata.title) {
                throw new Error("El plan de historia generado por la IA es inválido o está incompleto. Faltan metadatos esenciales.");
            }
            setGeneratedStoryPlan(newPlan);
            setGenerationProgress(prev => ({ ...prev, plan: 'complete', docs: 'in_progress', critique: 'in_progress' }));

            const [docs, crit] = await Promise.all([
                generateAllDocumentation(newPlan),
                generateCritique(newPlan, storyData),
            ]);
            
            setDocumentation(docs);
            setCritique(crit);
            setGenerationProgress(prev => ({ ...prev, docs: 'complete', critique: 'complete' }));

            setPhase('6.1');
        } catch(err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            setError(msg);
            setGenerationProgress({ plan: 'error', critique: 'error', docs: 'error' });
        } finally {
            setIsLoading(false);
        }
        return;
    }
    
    setPhase(String(currentPhaseNum + 1));
  };

  const handleApplyImprovements = async () => {
    if (!generatedStoryPlan || !critique) return;
    setIsLoading(true);
    setError(null);
    try {
        const regeneratedPlan = await regenerateStoryPlanWithCritique(generatedStoryPlan, critique, (phase, message) => {
            console.log(`Regen Progress: ${phase} - ${message}`);
        });
        setGeneratedStoryPlan(regeneratedPlan);

        // Regenerate docs and critique with the new plan
        const [newDocs, newCritique] = await Promise.all([
            generateAllDocumentation(regeneratedPlan),
            generateCritique(regeneratedPlan, storyData),
        ]);
        setDocumentation(newDocs);
        setCritique(newCritique);

        setPhase('6.2');
    } catch(err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(msg);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleGenerateReferenceAssets = async (aspectRatio: ReferenceAsset['aspectRatio']) => {
      handleAutoGeneratePhase63();
  };


  const handleGenerateFrameForScene = async (scene: Scene, frameType: 'start' | 'climax' | 'end') => {
      if (!generatedStoryPlan || !referenceAssets) return;
      const loadingKey = `${scene.scene_number}-${frameType}`;
      setLoadingScenes(prev => ({ ...prev, [loadingKey]: true }));
      try {
          const newFrame = await generateHybridNeuralSceneFrame(generatedStoryPlan, scene, referenceAssets, referenceAssetAspectRatio, frameType, storyData, (message) => console.log(message));
          setReferenceAssets(prev => prev ? { ...prev, sceneFrames: [...prev.sceneFrames, newFrame] } : null);
      } catch (err) {
          const msg = err instanceof Error ? err.message : "Error al generar el fotograma.";
          setError(msg);
      } finally {
          setLoadingScenes(prev => ({ ...prev, [loadingKey]: false }));
      }
  };

  const handleUpdateAsset = (id: string, instruction: string) => {
    setReferenceAssets(prev => {
        if (!prev) return null;
        const update = (assets: ReferenceAsset[]) => assets.map(a => a.id === id ? { ...a, instruction } : a);
        return {
            characters: update(prev.characters),
            environments: update(prev.environments),
            elements: update(prev.elements),
            sceneFrames: update(prev.sceneFrames),
        };
    });
  };
  
  const handleDeleteAsset = (id: string) => {
      imageBlobCache.remove(id); // Important: remove blob from memory
      setReferenceAssets(prev => {
          if (!prev) return null;
          return {
              characters: prev.characters.filter(a => a.id !== id),
              environments: prev.environments.filter(a => a.id !== id),
              elements: prev.elements.filter(a => a.id !== id),
              sceneFrames: prev.sceneFrames.filter(a => a.id !== id),
          };
      });
  };

  const handleUploadAsset = (type: 'character' | 'environment' | 'element', file: File) => {
      const newAsset: ReferenceAsset = {
          id: crypto.randomUUID(),
          name: file.name.split('.')[0],
          type: type,
          prompt: 'Subido por el usuario',
          aspectRatio: referenceAssetAspectRatio, // Assume current aspect ratio
          source: 'user',
      };
      const blob = new Blob([file], { type: file.type });
      imageBlobCache.set(newAsset.id, blob);
      setReferenceAssets(prev => {
          if (!prev) return { characters: [], environments: [], elements: [], sceneFrames: [] };
          const key = `${type}s` as keyof GeneratedReferenceAssets;
          return { ...prev, [key]: [...(prev[key] as ReferenceAsset[]), newAsset] };
      });
  };

  const handleFinalGeneration = async () => {
    if (!generatedStoryPlan || !referenceAssets || !documentation) return;
    setPhase('6.4');
    setIsLoading(true);
    setError(null);
    setAssetGenerationProgress({});
    try {
        const finalAssetsResult = await runFinalVideoGenerationPipeline(
            generatedStoryPlan,
            referenceAssets,
            documentation.aiProductionGuide,
            (update) => {
                setAssetGenerationProgress(prev => ({ ...prev, [update.sceneId || 'global']: update }));
            }
        );
        setFinalAssets(finalAssetsResult);
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Error en la generación final.";
        setError(msg);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleExportProject = async () => {
    if (!generatedStoryPlan || !documentation || !referenceAssets) {
        alert("Se necesita un plan, documentación y activos para exportar.");
        return;
    }
    await downloadProjectLocally(generatedStoryPlan, documentation, referenceAssets, critique);
  };

  const handleSaveLocally = async () => {
    if (!generatedStoryPlan || !documentation || !referenceAssets) {
        alert("Se necesita un plan, documentación y activos para guardar localmente.");
        return;
    }

    try {
        const convertAssetsForStorage = async (assets: ReferenceAsset[]): Promise<ExportedReferenceAsset[]> => {
            const exportedAssets: ExportedReferenceAsset[] = [];
            for (const asset of assets) {
                const blob = imageBlobCache.get(asset.id);
                if (blob) {
                    await assetDBService.saveAsset(asset.id, blob);
                    // Don't include imageData for local storage, just the metadata
                    const { ...rest } = asset;
                    exportedAssets.push(rest);
                }
            }
            return exportedAssets;
        };
        
        const assetsToStore: ExportedGeneratedReferenceAssets = {
            characters: await convertAssetsForStorage(referenceAssets.characters),
            environments: await convertAssetsForStorage(referenceAssets.environments),
            elements: await convertAssetsForStorage(referenceAssets.elements),
            sceneFrames: await convertAssetsForStorage(referenceAssets.sceneFrames),
        };

        const projectToSave: ExportedProject = {
            plan: generatedStoryPlan,
            documentation,
            critique: critique || {} as Critique,
            assets: assetsToStore
        };
        
        projectPersistenceService.saveProject(projectToSave);

        alert("¡Proyecto guardado localmente! Los activos están en la base de datos de tu navegador y la metadata en el almacenamiento local.");

    } catch (error) {
        console.error("Fallo al guardar el proyecto localmente:", error);
        alert(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };


  const renderPhase = () => {
    const currentPhaseNum = parseFloat(phase);
    
    if (currentPhaseNum >= 6.4) {
        return <AssetGenerationView
            isLoading={isLoading}
            progress={assetGenerationProgress}
            assets={finalAssets}
            error={error}
            storyPlan={generatedStoryPlan}
            onRegenerate={handleFinalGeneration}
            onGoToPhase={(p) => setPhase(String(p))}
        />;
    }
    
    if (currentPhaseNum >= 6.3) {
        return <ReferenceAssetView 
            isLoading={isLoading}
            assets={referenceAssets}
            error={error}
            onContinue={handleFinalGeneration}
            onRegenerate={handleGenerateReferenceAssets}
            onUpdateAsset={handleUpdateAsset}
            onDeleteAsset={handleDeleteAsset}
            onUploadAsset={handleUploadAsset}
            aspectRatio={referenceAssetAspectRatio}
            setAspectRatio={setReferenceAssetAspectRatio}
            onExportProject={handleExportProject}
            storyPlan={generatedStoryPlan}
            onGenerateFrameForScene={handleGenerateFrameForScene}
            loadingScenes={loadingScenes}
            onSaveLocally={handleSaveLocally}
            generationProgress={assetGenerationUIProgress}
            onCancelGeneration={cancelCurrentGeneration}
        />;
    }

    if (currentPhaseNum >= 6.2) {
        return <RefinementPhaseView
            storyPlan={generatedStoryPlan}
            documentation={documentation}
            onStartReferenceGeneration={() => setPhase('6.3')}
        />
    }

    if (currentPhaseNum >= 6.1) {
        return <EvaluationPhaseView
            critique={critique}
            isLoading={isLoading}
            onApplyImprovements={handleApplyImprovements}
            onContinue={() => setPhase('6.2')}
            onGoToPhase={(p) => setPhase(String(p))}
        />
    }

    if (isLoading && currentPhaseNum === 4) {
         return (
            <div className="text-center py-8">
                <Spinner />
                <p className="mt-4 text-gray-400">Generando plan de historia, documentación y crítica...</p>
                <div className="mt-2 text-sm text-blue-400 space-y-1">
                    <p>{generationProgress.plan === 'in_progress' ? '🔄' : '✅'} Generando Plan de Historia...</p>
                    <p>{generationProgress.plan === 'complete' && generationProgress.docs === 'in_progress' ? '🔄' : (generationProgress.docs === 'complete' ? '✅' : '⏳')} Generando Documentación...</p>
                    <p>{generationProgress.plan === 'complete' && generationProgress.critique === 'in_progress' ? '🔄' : (generationProgress.critique === 'complete' ? '✅' : '⏳')} Generando Crítica...</p>
                </div>
            </div>
        );
    }
    
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {phase === '1' && (
            <div className="animate-fade-in">
                 <h3 className="text-2xl font-bold text-center mb-4">FASE 1: El Concepto</h3>
                 <p className="text-gray-400 text-center mb-6">Empieza con tu idea. ¿De qué trata tu historia? Sé breve pero específico.</p>
                <textarea
                    value={storyData.concept}
                    onChange={(e) => updateData('concept', e.target.value)}
                    placeholder="Ej: Un astronauta varado en Marte que debe cultivar patatas para sobrevivir."
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                />
                 <h4 className="font-semibold mt-4 mb-2">Opcional: Sube un guion o contexto</h4>
                <input type="file" accept=".pdf,.txt,.md" onChange={(e) => updateData('storyPDF', e.target.files?.[0] || null)} className="w-full text-sm" />
                 <h4 className="font-semibold mt-4 mb-2">Opcional: Sube imágenes de referencia visual</h4>
                 <input type="file" accept="image/*" multiple onChange={(e) => updateData('contextImages', Array.from(e.target.files || []))} className="w-full text-sm" />
            </div>
        )}
        {phase === '2' && (
            <div className="animate-fade-in space-y-6">
                <div>
                     <h3 className="text-2xl font-bold text-center mb-4">FASE 2: Estilo y Energía</h3>
                     <p className="text-gray-400 text-center mb-6">Elige el formato, los estilos y el nivel de energía para tu historia.</p>
                     <label className="font-semibold mb-2 block">Formato de Salida</label>
                    <select
                        value={storyData.format}
                        onChange={(e) => updateData('format', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3"
                    >
                        {Object.entries(outputFormats).map(([groupName, formats]) => (
                            <optgroup label={groupName} key={groupName}>
                                {formats.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                     <p className="text-xs text-gray-500 mt-1">{outputFormats[Object.keys(outputFormats).find(k => outputFormats[k as keyof typeof outputFormats].some(f => f.value === storyData.format)) || 'Video (Redes Sociales)'].find(f => f.value === storyData.format)?.description}</p>
                </div>
                 <div>
                    <MultiSelectGrid
                        title="Estilos Narrativos"
                        categories={narrativeStyles}
                        selectedItems={storyData.narrativeStyles}
                        onToggle={toggleNarrativeStyle}
                        maxSelection={3}
                        helpText="Define el género y el tono de tu historia."
                    />
                </div>
                 <div>
                    <MultiSelectGrid
                        title="Estilos Visuales"
                        categories={visualStyles}
                        selectedItems={storyData.visualStyles}
                        onToggle={toggleVisualStyle}
                        maxSelection={5}
                        helpText="Define la estética visual de tu proyecto."
                    />
                </div>
                <div>
                    <label className="font-semibold mb-2 block">Nivel de Energía (1-10)</label>
                    <p className="text-sm text-gray-400 mb-3">Define el ritmo. 1 es lento y contemplativo, 10 es rápido y frenético.</p>
                    <input
                        type="range"
                        min="1" max="10"
                        value={storyData.energyLevel}
                        onChange={(e) => updateData('energyLevel', parseInt(e.target.value))}
                        className="w-full"
                    />
                </div>
            </div>
        )}
        {phase === '3' && (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-center mb-4">FASE 3: Personajes</h3>
                <p className="text-gray-400 text-center mb-6">Define a los personajes principales. Sube imágenes de referencia para guiar a la IA y lograr consistencia visual.</p>
                <div className="space-y-4">
                    {storyData.characters.map((char, index) => (
                        <div key={char.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex gap-4">
                            <div className="flex-grow space-y-2">
                                <input
                                    type="text"
                                    placeholder={`Nombre del Personaje ${index + 1}`}
                                    value={char.name}
                                    onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                                />
                                <textarea
                                    placeholder={`Descripción del Personaje ${index + 1} (apariencia, personalidad)`}
                                    value={char.description}
                                    onChange={(e) => updateCharacter(char.id, 'description', e.target.value)}
                                    rows={3}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2"
                                />
                            </div>
                            <div className="w-32 flex-shrink-0">
                                <label className="cursor-pointer">
                                     <div className="w-full h-32 bg-gray-900 rounded border-2 border-dashed border-gray-600 flex items-center justify-center text-center text-xs text-gray-400 hover:bg-gray-800 hover:border-blue-500">
                                        {char.imagePreviewUrl ? <img src={char.imagePreviewUrl} alt="preview" className="w-full h-full object-cover"/> : 'Subir Imagen de Referencia'}
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => updateCharacter(char.id, 'image', e.target.files?.[0] || null)}/>
                                </label>
                                {char.image && <button onClick={() => updateCharacter(char.id, 'image', null)} className="w-full text-xs text-red-400 hover:underline mt-1">Quitar</button>}
                            </div>
                            {storyData.characters.length > 1 && (
                                <button onClick={() => removeCharacter(char.id)} className="self-start text-red-400"><XCircleIcon className="w-6 h-6"/></button>
                            )}
                        </div>
                    ))}
                </div>
                {storyData.characters.length < 5 && <button onClick={addCharacter} className="mt-4 w-full bg-white/10 p-2 rounded hover:bg-white/20">Añadir Personaje</button>}
            </div>
        )}
        {phase === '4' && (
            <div className="animate-fade-in space-y-4">
                 <h3 className="text-2xl font-bold text-center mb-4">FASE 4: Estructura y Trama</h3>
                 <p className="text-gray-400 text-center mb-6">Define los pilares de tu historia. ¿Cómo empieza, qué la impulsa y cómo termina?</p>
                <div>
                     <MultiSelectGrid
                        title="Estructura Narrativa"
                        categories={{ "Estructuras": narrativeStructures }}
                        selectedItems={storyData.narrativeStructure}
                        onToggle={toggleNarrativeStructure}
                        maxSelection={3}
                        helpText="El esqueleto de tu historia."
                    />
                </div>
                 <div>
                    <MultiSelectGrid
                        title="Gancho Inicial (Hook)"
                        categories={hookTypes}
                        selectedItems={storyData.hook}
                        onToggle={toggleHook}
                        maxSelection={5}
                        helpText="¿Cómo capturarás la atención en los primeros 3 segundos?"
                    />
                </div>
                 <div>
                    <MultiSelectGrid
                        title="Conflicto Central"
                        categories={conflictTypes}
                        selectedItems={storyData.conflict}
                        onToggle={toggleConflict}
                        maxSelection={10}
                        helpText="El motor de tu historia. ¿A qué se enfrentan los personajes?"
                    />
                </div>
                <div>
                    <MultiSelectGrid
                        title="Tipo de Final"
                        categories={endingTypes}
                        selectedItems={storyData.ending}
                        onToggle={toggleEnding}
                        maxSelection={5}
                        helpText="¿Cómo quieres que se sienta la audiencia al final?"
                    />
                </div>
            </div>
        )}
        {error && !isLoading && <p className="text-center text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
        {parseFloat(phase) < 5 &&
            <div className="pt-6 border-t border-gray-700">
                <button
                    onClick={handleNextPhase}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                   {isLoading ? 'Generando...' : (phase === '4' ? 'Generar Plan de Historia (JSON)' : 'Siguiente Fase')}
                </button>
            </div>
        }
      </div>
    );
  };

  const currentPhaseNum = parseFloat(phase);

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in">
        <GeminiWebLogin />
        <div className="flex flex-col lg:flex-row gap-8">
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
            <div className="flex-grow bg-gray-800/50 border border-gray-700/80 rounded-lg p-6 min-h-[50vh] flex flex-col justify-center">
                {renderPhase()}
            </div>
        </div>
        <div className="mt-8">
            <button onClick={() => setShowDevTools(!showDevTools)} className="text-sm text-gray-500 hover:text-white">
                {showDevTools ? 'Ocultar' : 'Mostrar'} Herramientas de Desarrollador
            </button>
            {showDevTools && (
                <div className="mt-2 grid grid-cols-1 gap-4 animate-fade-in">
                   <APIStatusPanel />
                </div>
            )}
        </div>
    </div>
  );
};

export default StoryBuilder;