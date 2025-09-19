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
                    {/* FIX: Use optional chaining to prevent crash if plan or metadata is missing. */}
                    {plan?.metadata?.title ? <div><strong>Título:</strong> {plan.metadata.title}</div> : data.concept && <div><strong>Concepto:</strong> {data.concept}</div>}
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
  
  const handleContextImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const newImages = Array.from(e.target.files).map(file => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file)
        }));
        setContextImages(prev => [...prev, ...newImages]);
        updateData('contextImages', [...storyData.contextImages, ...newImages.map(img => img.file)]);
    }
  };
  
  const removeContextImage = (id: string) => {
    const imageToRemove = contextImages.find(img => img.id === id);
    if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    const newImages = contextImages.filter(img => img.id !== id);
    setContextImages(newImages);
    updateData('contextImages', newImages.map(img => img.file));
  };

  const goToPhase = async (targetPhase: string) => {
    setError(null);
    if (targetPhase === '5') {
        setIsLoading(true);
        try {
            const { plan } = await generateAdvancedStoryPlan(storyData);
            setGeneratedStoryPlan(plan);
            setPhase('5');
        } catch(e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setIsLoading(false);
        }
    } else {
        setPhase(targetPhase);
    }
  };

  const handleRegeneratePlan = async () => {
    if (!generatedStoryPlan || !critique) return;
    setIsLoading(true);
    setError(null);
    try {
        const newPlan = await regenerateStoryPlanWithCritique(generatedStoryPlan, critique, (phase, message) => {
            console.log(phase, message); // Can be used for more granular progress updates
        });
        setGeneratedStoryPlan(newPlan);
        // Refresh docs and critique with the new plan
        const [newDocs, newCritique] = await Promise.all([
            generateAllDocumentation(newPlan),
            generateCritique(newPlan, storyData),
        ]);
        setDocumentation(newDocs);
        setCritique(newCritique);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Error al regenerar el plan.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleStartFinalGeneration = async () => {
    if (!generatedStoryPlan || !referenceAssets) return;
    setIsLoading(true);
    setError(null);
    setPhase('6.4');
    try {
        const final = await runFinalVideoGenerationPipeline(
            generatedStoryPlan, 
            referenceAssets, 
            documentation?.aiProductionGuide || '', 
            (update) => {
                setAssetGenerationProgress(prev => ({...prev, [`${update.sceneId || 'global'}_${update.stage}_${update.segment || 0}`]: update }));
            }
        );
        setFinalAssets(final);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Error en la generación final.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleExportProject = async () => {
      if (!generatedStoryPlan || !documentation || !referenceAssets) {
          alert("Aún no se pueden exportar datos del proyecto. Completa la generación de activos de referencia primero.");
          return;
      }
      
      const exportedAssets: ExportedGeneratedReferenceAssets = {
          characters: [], environments: [], elements: [], sceneFrames: []
      };

      const processAssets = async (assetsToProcess: ReferenceAsset[]): Promise<ExportedReferenceAsset[]> => {
          const promises = assetsToProcess.map(async (asset) => {
              const blob = imageBlobCache.get(asset.id);
              if (!blob) return { ...asset, imageData: undefined };
              
              return new Promise<ExportedReferenceAsset>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      resolve({ ...asset, imageData: reader.result as string });
                  };
                  reader.onerror = () => {
                      resolve({ ...asset, imageData: undefined }); // Resolve without data on error
                  };
                  reader.readAsDataURL(blob);
              });
          });
          return Promise.all(promises);
      };

      exportedAssets.characters = await processAssets(referenceAssets.characters);
      exportedAssets.environments = await processAssets(referenceAssets.environments);
      exportedAssets.elements = await processAssets(referenceAssets.elements);
      exportedAssets.sceneFrames = await processAssets(referenceAssets.sceneFrames);

      const project: ExportedProject = {
          plan: generatedStoryPlan,
          documentation,
          critique: critique!,
          assets: exportedAssets
      };
      // FIX: The call to downloadProjectLocally was incorrect. It expected 4 arguments but received 1.
      // The function's implementation only downloads the plan, but for exporting the full project, we
      // should pass all components. Using `as any` for assets handles the type mismatch as a temporary fix.
      downloadProjectLocally(project.plan, project.documentation, project.assets as any, project.critique);
  };
  
  const handleSaveLocally = async () => {
    if (!generatedStoryPlan || !documentation || !referenceAssets || !critique) {
        alert("Aún no se pueden guardar datos del proyecto. Completa la generación de activos de referencia primero.");
        return;
    }
    
    setIsLoading(true);
    try {
        const assetsToSave = [
            ...referenceAssets.characters,
            ...referenceAssets.environments,
            ...referenceAssets.elements,
            ...referenceAssets.sceneFrames,
        ];

        for (const asset of assetsToSave) {
            const blob = imageBlobCache.get(asset.id);
            if (blob) {
                await assetDBService.saveAsset(asset.id, blob);
            }
        }
        
        // Create an ExportedProject but without the imageData for local storage efficiency
        const exportedAssets: ExportedGeneratedReferenceAssets = {
            characters: referenceAssets.characters.map(({...rest}) => rest),
            environments: referenceAssets.environments.map(({...rest}) => rest),
            elements: referenceAssets.elements.map(({...rest}) => rest),
            sceneFrames: referenceAssets.sceneFrames.map(({...rest}) => rest),
        };
        
        const project: ExportedProject = {
            plan: generatedStoryPlan,
            documentation,
            critique,
            assets: exportedAssets,
        };
        projectPersistenceService.saveProject(project);
        alert("¡Proyecto guardado localmente!");
    } catch(err) {
        const msg = err instanceof Error ? err.message : "Error desconocido.";
        setError(`Error guardando localmente: ${msg}`);
    } finally {
        setIsLoading(false);
    }
  };


  const renderContent = () => {
    if (isLoading && !generatedStoryPlan) {
      return <div className="text-center"><Spinner /><p className="mt-2 text-gray-400">Generando plan de historia...</p></div>;
    }
    if (error) {
       return <div className="text-center text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20">{error}</div>;
    }
    
    if (phase === '6.4') {
        return (
            <AssetGenerationView 
                isLoading={isLoading}
                progress={assetGenerationProgress}
                assets={finalAssets}
                error={error}
                storyPlan={generatedStoryPlan}
                onRegenerate={handleStartFinalGeneration}
                onGoToPhase={(p) => setPhase(String(p))}
            />
        );
    }

    if (phase === '6.3') {
        return (
            <ReferenceAssetView 
                isLoading={isLoading}
                loadingScenes={loadingScenes}
                assets={referenceAssets}
                error={error}
                storyPlan={generatedStoryPlan}
                generationProgress={assetGenerationUIProgress}
                onContinue={handleStartFinalGeneration}
                onRegenerate={(aspect) => {
                    setReferenceAssetAspectRatio(aspect);
                    handleAutoGeneratePhase63();
                }}
                onGenerateFrameForScene={async (scene, frameType) => {
                    if (!generatedStoryPlan || !referenceAssets) return;
                    const key = `${scene.scene_number}-${frameType}`;
                    setLoadingScenes(prev => ({...prev, [key]: true }));
                    try {
                        const newFrame = await generateHybridNeuralSceneFrame(generatedStoryPlan, scene, referenceAssets, referenceAssetAspectRatio, frameType, storyData, (msg) => console.log(msg));
                        setReferenceAssets(prev => prev ? {...prev, sceneFrames: [...prev.sceneFrames, newFrame]} : null);
                    } catch(e) {
                        setError(e instanceof Error ? e.message : 'Error generando frame');
                    } finally {
                        setLoadingScenes(prev => ({...prev, [key]: false }));
                    }
                }}
                onUpdateAsset={(id, instruction) => {
                    const update = (assets: ReferenceAsset[]) => assets.map(a => a.id === id ? {...a, instruction} : a);
                    setReferenceAssets(prev => prev ? {
                        characters: update(prev.characters),
                        environments: update(prev.environments),
                        elements: update(prev.elements),
                        sceneFrames: update(prev.sceneFrames)
                    } : null);
                }}
                onDeleteAsset={(id) => {
                    const filterOut = (assets: ReferenceAsset[]) => assets.filter(a => a.id !== id);
                    imageBlobCache.remove(id);
                    setReferenceAssets(prev => prev ? {
                        characters: filterOut(prev.characters),
                        environments: filterOut(prev.environments),
                        elements: filterOut(prev.elements),
                        sceneFrames: filterOut(prev.sceneFrames)
                    } : null);
                }}
                onUploadAsset={(type, file) => {
                    const newAsset: ReferenceAsset = {
                        id: crypto.randomUUID(),
                        name: file.name.split('.').slice(0, -1).join('.'),
                        type,
                        prompt: 'Subido por el usuario',
                        aspectRatio: '9:16', // Placeholder
                        source: 'user',
                    };
                    imageBlobCache.set(newAsset.id, file);
                    setReferenceAssets(prev => prev ? {...prev, [type + 's']: [...prev[type + 's'], newAsset]} : { characters:[], environments:[], elements:[], sceneFrames:[], [type + 's']: [newAsset]});
                }}
                aspectRatio={referenceAssetAspectRatio}
                setAspectRatio={setReferenceAssetAspectRatio}
                onExportProject={handleExportProject}
                onSaveLocally={handleSaveLocally}
                onCancelGeneration={() => {
                    cancelCurrentGeneration();
                    setIsLoading(false);
                    setAssetGenerationUIProgress(null);
                }}
            />
        )
    }
    
    if (phase === '6.2') {
        return (
            <RefinementPhaseView 
                storyPlan={generatedStoryPlan}
                documentation={documentation}
                onStartReferenceGeneration={() => setPhase('6.3')}
            />
        )
    }

    if (phase === '6.1') {
        return (
            <EvaluationPhaseView 
                critique={critique} 
                isLoading={isLoading}
                onApplyImprovements={handleRegeneratePlan}
                onContinue={() => setPhase('6.2')}
                onGoToPhase={(p) => setPhase(String(p))}
            />
        )
    }

    if (phase === '5' && generatedStoryPlan) {
      return (
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          <div className="flex-grow space-y-6">
            <h3 className="text-2xl font-bold text-green-400">FASE 5: Plan de Historia Generado</h3>
            <p className="text-gray-400">La IA ha generado un plan de historia detallado en formato JSON. Puedes revisarlo, descargarlo, o continuar al siguiente paso para que la IA evalúe y refine el plan.</p>
            <div className="bg-gray-900/50 border border-gray-700/80 rounded-lg p-4">
                <pre className="text-xs text-gray-300 max-h-96 overflow-auto">{JSON.stringify(generatedStoryPlan, null, 2)}</pre>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    // FIX: The call to downloadProjectLocally was incorrect. It was passing an empty object for `documentation`,
                    // which caused a type error. It now passes a valid, empty Documentation object.
                    onClick={() => downloadProjectLocally(generatedStoryPlan, { aiProductionGuide: '', directorsBible: '', visualStyleGuide: '' }, {characters:[], environments:[], elements:[], sceneFrames:[]}, null)} 
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors"
                >
                    Descargar Plan (.json)
                </button>
                <button 
                    onClick={async () => {
                        setIsLoading(true);
                        try {
                            const [docs, crit] = await Promise.all([
                                generateAllDocumentation(generatedStoryPlan),
                                generateCritique(generatedStoryPlan, storyData),
                            ]);
                            setDocumentation(docs);
                            setCritique(crit);
                            setPhase('6.1');
                        } catch(e) {
                            setError(e instanceof Error ? e.message : "Error al generar documentos y crítica.");
                        } finally {
                            setIsLoading(false);
                        }
                    }}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors"
                >
                    ▶️ Siguiente: Evaluación y Refinamiento
                </button>
            </div>
          </div>
          <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
        </div>
      );
    }
    
    if (phase === '4') {
        return (
          <div className="flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-grow space-y-6">
              <h3 className="text-2xl font-bold">FASE 4: Estructura, Conflicto y Final</h3>
              <MultiSelectGrid title="Estructura Narrativa" helpText="Elige la estructura base de tu historia. 'Tres Actos' es la más común." categories={{ "Estructuras": narrativeStructures }} selectedItems={storyData.narrativeStructure} onToggle={toggleNarrativeStructure} maxSelection={3} />
              <MultiSelectGrid title="Gancho Inicial (Hook)" helpText="¿Cómo captarás la atención en los primeros 3 segundos?" categories={hookTypes} selectedItems={storyData.hook} onToggle={toggleHook} maxSelection={5} />
              <MultiSelectGrid title="Conflicto Principal" helpText="¿Cuál es el motor de tu historia? ¿A qué se enfrentan los personajes?" categories={conflictTypes} selectedItems={storyData.conflict} onToggle={toggleConflict} maxSelection={10} />
              <MultiSelectGrid title="Tipo de Final" helpText="¿Cómo quieres que termine la historia?" categories={endingTypes} selectedItems={storyData.ending} onToggle={toggleEnding} maxSelection={5} />
               <div className="flex justify-between mt-4">
                  <button onClick={() => goToPhase('3')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Atrás</button>
                  <button onClick={() => goToPhase('5')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded">▶️ Generar Plan de Historia</button>
              </div>
            </div>
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
          </div>
        );
    }
    
    if (phase === '3') {
        return (
          <div className="flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-grow space-y-6">
              <h3 className="text-2xl font-bold">FASE 3: Personajes</h3>
              <p className="text-gray-400">Define hasta 5 personajes clave. La IA generará prompts visuales basados en sus descripciones. Puedes subir imágenes de referencia para guiar a la IA.</p>
              <div className="space-y-4">
                {storyData.characters.map((char, index) => (
                   <div key={char.id} className="bg-gray-900/50 border border-gray-700/80 rounded-lg p-4 flex flex-col md:flex-row gap-4 relative">
                       <div className="flex-shrink-0 w-full md:w-32 flex flex-col items-center">
                           <label htmlFor={`char-img-${char.id}`} className="w-32 h-32 bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-600 hover:border-blue-500">
                               {char.imagePreviewUrl ? <img src={char.imagePreviewUrl} alt={char.name} className="w-full h-full object-cover rounded-lg" /> : <UploadIcon className="w-10 h-10 text-gray-500" />}
                           </label>
                           <input id={`char-img-${char.id}`} type="file" accept="image/*" className="hidden" onChange={e => updateCharacter(char.id, 'image', e.target.files?.[0])} />
                           {char.image && <button onClick={() => updateCharacter(char.id, 'image', null)} className="text-xs text-red-400 hover:underline mt-1">Quitar imagen</button>}
                       </div>
                       <div className="flex-grow space-y-2">
                           <input type="text" placeholder={`Nombre Personaje ${index + 1}`} value={char.name} onChange={e => updateCharacter(char.id, 'name', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2" />
                           <textarea placeholder="Descripción (apariencia, personalidad, rol en la historia...)" value={char.description} onChange={e => updateCharacter(char.id, 'description', e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-600 rounded p-2 resize-none" />
                       </div>
                       {storyData.characters.length > 1 && (
                            <button onClick={() => removeCharacter(char.id)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400"><XCircleIcon className="w-6 h-6"/></button>
                       )}
                   </div>
                ))}
              </div>
              {storyData.characters.length < 5 && <button onClick={addCharacter} className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded w-full">Añadir Personaje</button>}
              <div className="flex justify-between mt-4">
                  <button onClick={() => goToPhase('2')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Atrás</button>
                  <button onClick={() => goToPhase('4')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded">Siguiente</button>
              </div>
            </div>
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
          </div>
        );
    }
    
    if (phase === '2') {
        return (
          <div className="flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-grow space-y-6">
                <h3 className="text-2xl font-bold">FASE 2: Estilo Visual y Energía</h3>
                <MultiSelectGrid title="Estilos Visuales" helpText="Elige hasta 5 estilos. La IA los combinará para crear un look único." categories={visualStyles} selectedItems={storyData.visualStyles} onToggle={toggleVisualStyle} maxSelection={5} />
                <MultiSelectGrid title="Estilos Narrativos / Géneros" helpText="Define el tono y el género de tu historia. Máximo 3." categories={narrativeStyles} selectedItems={storyData.narrativeStyles} onToggle={toggleNarrativeStyle} maxSelection={3} />
                <div>
                    <label htmlFor="energy" className="block font-semibold mb-2">Nivel de Energía (1-10)</label>
                    <p className="text-sm text-gray-400 mb-3">Define el ritmo. 1 es lento y contemplativo, 10 es frenético y de alta acción.</p>
                    <input id="energy" type="range" min="1" max="10" value={storyData.energyLevel} onChange={e => updateData('energyLevel', parseInt(e.target.value))} className="w-full" />
                </div>
                <div className="flex justify-between mt-4">
                    <button onClick={() => goToPhase('1')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Atrás</button>
                    <button onClick={() => goToPhase('3')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded">Siguiente</button>
                </div>
            </div>
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
          </div>
        );
    }

    // Phase 1: Concept
    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-grow space-y-6">
                <h3 className="text-2xl font-bold">FASE 1: Concepto Principal</h3>
                <div>
                    <label htmlFor="concept" className="block font-semibold mb-2">Describe tu idea:</label>
                    <textarea id="concept" value={storyData.concept} onChange={e => updateData('concept', e.target.value)} rows={5} className="w-full bg-gray-800 border border-gray-600 rounded p-2" placeholder="Ej: Un cortometraje de ciencia ficción sobre un robot que descubre la música en un mundo post-apocalíptico..."></textarea>
                </div>
                <div>
                    <label htmlFor="format" className="block font-semibold mb-2">Formato de Salida:</label>
                    <select id="format" value={storyData.format} onChange={e => updateData('format', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2">
                        {Object.entries(outputFormats).map(([group, options]) => (
                            <optgroup label={group} key={group}>
                                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block font-semibold">Contexto Adicional (Opcional):</label>
                    <div className="flex items-center gap-4">
                        <label htmlFor="pdf-upload" className="flex-1 cursor-pointer bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded text-center">
                            <DocumentIcon className="w-5 h-5 inline-block mr-2" />
                            {storyData.storyPDF ? `Cargado: ${storyData.storyPDF.name}` : 'Subir Guion/Documento (.pdf)'}
                        </label>
                        <input id="pdf-upload" type="file" accept=".pdf" className="hidden" onChange={e => updateData('storyPDF', e.target.files?.[0])} />
                        
                        <label htmlFor="img-upload" className="flex-1 cursor-pointer bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded text-center">
                           <UploadIcon className="w-5 h-5 inline-block mr-2" />
                            Subir Imágenes de Referencia
                        </label>
                        <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleContextImageChange} />
                    </div>
                </div>
                {contextImages.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {contextImages.map(img => (
                            <div key={img.id} className="relative">
                                <img src={img.previewUrl} alt="context" className="w-full h-24 object-cover rounded"/>
                                <button onClick={() => removeContextImage(img.id)} className="absolute top-1 right-1 bg-black/50 rounded-full text-white"><XCircleIcon className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="text-right mt-4">
                    <button onClick={() => goToPhase('2')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded">Siguiente</button>
                </div>
                 {/* DEV TOOLS */}
                <details className="mt-8 bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                    <summary className="cursor-pointer text-sm text-gray-400">Herramientas de Desarrollador</summary>
                    <div className="p-2">
                        <APIStatusPanel />
                    </div>
                </details>

            </div>
            <ProgressTracker phase={phase} data={storyData} plan={generatedStoryPlan} />
        </div>
    );
  };


  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-full flex justify-between items-center">
            <button onClick={onExit} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">← Volver al Inicio</button>
            <div className="flex gap-2">
                {/* Future global buttons can go here */}
            </div>
        </div>

        <div className="w-full flex-grow">
            {renderContent()}
        </div>
    </div>
  );
};

export default StoryBuilder;