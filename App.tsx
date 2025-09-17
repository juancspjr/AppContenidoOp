/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { TransformWrapper, TransformComponent, useControls, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { generateMagicEditImage, generateFilteredImage, generateAdjustedImage, generatePhotoshootScene, refineUserPrompt } from '@/services/geminiService';
import { renderFeatheredMask, cutAlphaHole, compositeOnlyInsideMask, imageToCanvas, blobToImage, changedOutsideMask } from '@/utils/canvasUtils';
import Header from '@/components/Header';
import Spinner from '@/components/Spinner';
import FilterPanel from '@/components/FilterPanel';
import { AdjustmentPanel } from '@/components/AdjustmentPanel';
import CropPanel from '@/components/CropPanel';
import MagicEditPanel from '@/components/MagicEditPanel';
import PhotoshootPanel from '@/components/PhotoshootPanel';
import { UndoIcon, RedoIcon, EyeIcon, ZoomInIcon, ZoomOutIcon, ResetZoomIcon, XCircleIcon, CheckCircleIcon, DownloadIcon } from '@/components/icons';
import StartScreen from '@/components/StartScreen';
import StoryBuilder from '@/components/StoryBuilder';
import LogPanel from '@/components/LogPanel';
import type { StoryMasterplan, ExportedProject } from '@/components/story-builder/types';
// FIX: Removed obsolete import for `apiKeyManager` and its associated `ApiKeyStatus` component.
// API key management is now handled by a simulated backend service (`geminiService.ts`) for security,
// making client-side status tracking unnecessary.

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'magic-edit' | 'adjust' | 'filters' | 'crop' | 'photoshoot';

const tabTooltips: Record<Tab, string> = {
    'magic-edit': 'Edición mágica: elimina objetos, añade elementos o cambia áreas específicas.',
    'adjust': 'Ajustes profesionales de color, luz y atmósfera.',
    'filters': 'Aplica filtros artísticos y creativos.',
    'crop': 'Recortar y enderezar la imagen.',
    'photoshoot': 'Simula una sesión de fotos profesional en cualquier entorno que imagines.'
};


// FIX: Explicitly typed ZoomControls as React.FC to prevent potential type inference issues.
const ZoomControls: React.FC = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    return (
        <div className="absolute bottom-2 right-2 z-40 bg-gray-800/80 border border-gray-700/80 rounded-lg p-1 flex items-center gap-1 backdrop-blur-sm">
            <button onClick={() => zoomIn()} className="p-2 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom In" title="Acercar (Zoom In)"><ZoomInIcon className="w-5 h-5" /></button>
            <button onClick={() => zoomOut()} className="p-2 hover:bg-white/10 rounded-md transition-colors" aria-label="Zoom Out" title="Alejar (Zoom Out)"><ZoomOutIcon className="w-5 h-5" /></button>
            <button onClick={() => resetTransform()} className="p-2 hover:bg-white/10 rounded-md transition-colors" aria-label="Reset Zoom" title="Restablecer Zoom"><ResetZoomIcon className="w-5 h-5" /></button>
        </div>
    );
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'start' | 'photo-editor' | 'story-builder'>('start');
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  // FIX: Renamed 'prompt' to 'magicEditPrompt' to avoid conflict with window.prompt.
  const [magicEditPrompt, setMagicEditPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('magic-edit');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  
  // Magic Edit State
  const [brushSize, setBrushSize] = useState<number>(40);
  const [featherSize, setFeatherSize] = useState<number>(5);
  const [brushMode, setBrushMode] = useState<'brush' | 'erase'>('brush');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [enhanceMagicEditPrompt, setEnhanceMagicEditPrompt] = useState<boolean>(true);
  const [isImageViewerHovered, setIsImageViewerHovered] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [imageResolution, setImageResolution] = useState<{width: number, height: number} | null>(null);
  
  // Photoshoot state
  const [photoshootResults, setPhotoshootResults] = useState<string[] | null>(null);
  const [editedPhotoshootResults, setEditedPhotoshootResults] = useState<Map<number, string> | null>(null);
  const [selectedPhotoshootIndices, setSelectedPhotoshootIndices] = useState<number[]>([]);
  const [focusedPhotoshootIndex, setFocusedPhotoshootIndex] = useState<number | null>(null);
  const [isProcessingMultiple, setIsProcessingMultiple] = useState<boolean>(false);
  const [sequentialProgress, setSequentialProgress] = useState<string | null>(null);
  const [lastSelectedPhotoshootIndex, setLastSelectedPhotoshootIndex] = useState<number | null>(null);

  // Story builder state
  const [importedProject, setImportedProject] = useState<StoryMasterplan | ExportedProject | null>(null);


  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const transformStateRef = useRef({ scale: 1, positionX: 0, positionY: 0 });
  const isRequestInProgressRef = useRef(false);


  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const isPhotoshootMode = !!photoshootResults;
  
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
  }, []);

  useEffect(() => {
    let activeUrl: string | null = null;
    
    if (isPhotoshootMode && focusedPhotoshootIndex !== null && photoshootResults) {
        const displayResults = photoshootResults.map((base, index) => editedPhotoshootResults?.get(index) || base);
        activeUrl = displayResults[focusedPhotoshootIndex] ?? null;
    } else if (currentImage) {
        activeUrl = URL.createObjectURL(currentImage);
    }

    setCurrentImageUrl(activeUrl);

    return () => {
        // Only revoke if it's a blob URL from createImageURL
        if (activeUrl && activeUrl.startsWith('blob:')) {
            URL.revokeObjectURL(activeUrl);
        }
    };
  }, [currentImage, isPhotoshootMode, photoshootResults, editedPhotoshootResults, focusedPhotoshootIndex]);
  
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  useEffect(() => {
    // Reset zoom when switching to a non-magic-edit tab
    // except when entering crop mode in a photoshoot.
    const shouldResetZoom = activeTab !== 'magic-edit' && !(isPhotoshootMode && activeTab === 'crop');
    if (shouldResetZoom && transformRef.current) {
        transformRef.current.resetTransform(0);
    }
  }, [activeTab, isPhotoshootMode]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const clearMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    setHasMask(false);
  }, []);

  const exitPhotoshootMode = () => {
    setPhotoshootResults(null);
    setEditedPhotoshootResults(null);
    setSelectedPhotoshootIndices([]);
    setFocusedPhotoshootIndex(null);
  }

  const clearExtraState = useCallback((keepLogs = false) => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    clearMask();
    setReferenceImage(null);
    exitPhotoshootMode();
    if (!keepLogs) {
      setLogs([]);
    }
  }, [clearMask]);

  const addImageToHistory = useCallback((newImageFile: File) => {
    exitPhotoshootMode();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCrop(undefined);
    setCompletedCrop(undefined);
    clearMask();
    setReferenceImage(null);
  }, [history, historyIndex, clearMask]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setActiveTab('magic-edit');
    clearExtraState();
    setImageResolution(null);
    setAppMode('photo-editor');
  }, [clearExtraState]);
  
  const handleProjectImport = useCallback((project: StoryMasterplan | ExportedProject) => {
    setImportedProject(project);
    setAppMode('story-builder');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isRequestInProgressRef.current) {
        addLog("⚠️ Petición ya en progreso. Por favor, espera.");
        return;
    }
    
    const imageSource = isPhotoshootMode 
        ? (focusedPhotoshootIndex !== null ? 'photoshoot_image' : null)
        : currentImage;

    if (!imageSource || !maskCanvasRef.current || !imgRef.current) {
        setError('La imagen, máscara o referencias requeridas no están disponibles.');
        return;
    }

    if (!hasMask) {
        setError('Por favor, pinta una máscara en la imagen para seleccionar un área a editar.');
        return;
    }
    
    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    let finalPrompt = magicEditPrompt;
    if (enhanceMagicEditPrompt) {
        addLog(`🤖 Refinando prompt con Agente de IA...`);
        try {
            finalPrompt = await refineUserPrompt(magicEditPrompt, 'magic-edit');
            addLog(`✨ Prompt refinado: "${finalPrompt}"`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al refinar prompt.';
            setError(`Fallo al refinar el prompt. ${errorMessage}`);
            addLog(`❌ ERROR de refinado: ${errorMessage}`);
            setIsLoading(false);
            isRequestInProgressRef.current = false;
            return;
        }
    }

    addLog(`Edición Mágica iniciada con Agente de IA. Suavizado: ${featherSize}px.`);

    try {
        const baseImageEl = imgRef.current;
        const userMaskCanvas = maskCanvasRef.current;

        addLog('Paso 1: Generando máscara con bordes suavizados...');
        const featheredMask = await renderFeatheredMask(userMaskCanvas, featherSize);

        addLog('Paso 2: Creando área transparente en la imagen base...');
        const holeCanvas = await cutAlphaHole(baseImageEl, featheredMask);
        const holeDataURL = holeCanvas.toDataURL('image/png');

        let referenceDataURL: string | undefined;
        if (referenceImage) {
            addLog('Preparando imagen de referencia...');
            referenceDataURL = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(referenceImage);
            });
        }
        
        addLog('Paso 3: Enviando petición a la IA para rellenar...');
        const editedBlob = await generateMagicEditImage({
            prompt: finalPrompt,
            baseHoleDataURL: holeDataURL,
            referenceDataURL,
        });
        addLog('Procesamiento de la IA completo.');

        const editedImage = await blobToImage(editedBlob);
        const editedCanvas = imageToCanvas(editedImage);
        
        addLog('Paso 4: Componiendo el resultado final...');
        const finalCanvas = await compositeOnlyInsideMask(baseImageEl, editedCanvas, featheredMask);
        
        if (changedOutsideMask(imageToCanvas(baseImageEl), editedCanvas, featheredMask)) {
            addLog('⚠️ La IA modificó píxeles fuera de la máscara; la composición del cliente lo ha corregido.');
        } else {
            addLog('✅ La IA respetó los límites de la máscara.');
        }

        if (isPhotoshootMode) {
            if (focusedPhotoshootIndex !== null) {
                const finalImageUrl = finalCanvas.toDataURL('image/png');
                const newEditedResults = new Map(editedPhotoshootResults || []);
                newEditedResults.set(focusedPhotoshootIndex, finalImageUrl);
                setEditedPhotoshootResults(newEditedResults);
                addLog(`🎉 ¡Edición Mágica completada con éxito en la imagen #${focusedPhotoshootIndex + 1}!`);
                clearMask();
            } else {
                addLog('⚠️ No se pudo aplicar la Edición Mágica: no hay ninguna imagen de la sesión enfocada.');
            }
        } else {
            const finalImageFile = dataURLtoFile(finalCanvas.toDataURL('image/png'), `edited-${Date.now()}.png`);
            addImageToHistory(finalImageFile);
            addLog('🎉 ¡Edición Mágica completada con éxito!');
        }

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
        setError(`Fallo al generar la imagen. ${errorMessage}`);
        addLog(`❌ ERROR: ${errorMessage}`);
        console.error(err);
    } finally {
        isRequestInProgressRef.current = false;
        setIsLoading(false);
    }
  }, [currentImage, magicEditPrompt, hasMask, addImageToHistory, referenceImage, featherSize, addLog, enhanceMagicEditPrompt, isPhotoshootMode, focusedPhotoshootIndex, editedPhotoshootResults, clearMask]);


  const handleApplyFilter = async (filterPrompt: string) => {
    if (isRequestInProgressRef.current) {
        addLog("⚠️ Petición ya en progreso. Por favor, espera.");
        return;
    }
    if (!currentImage) return;
    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    addLog(`Aplicando filtro con Agente de IA...`);
    try {
        const finalPrompt = await refineUserPrompt(filterPrompt, 'filter');
        addLog(`✨ Prompt de filtro refinado: "${finalPrompt}"`);
        const filteredImageUrl = await generateFilteredImage(currentImage, finalPrompt);
        addImageToHistory(dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`));
        addLog('✅ Filtro aplicado con éxito.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al aplicar el filtro: ${msg}`);
      addLog(`❌ Error de filtro: ${msg}`);
    } finally {
      isRequestInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  const handleApplyAdjustment = async (adjustmentPrompt: string) => {
    if (isRequestInProgressRef.current) {
        addLog("⚠️ Petición ya en progreso. Por favor, espera.");
        return;
    }
    if (!currentImage) return;
    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    addLog(`Aplicando ajuste con Agente de IA...`);
    try {
        const finalPrompt = await refineUserPrompt(adjustmentPrompt, 'adjustment');
        addLog(`✨ Prompt de ajuste refinado: "${finalPrompt}"`);
        const adjustedImageUrl = await generateAdjustedImage(currentImage, finalPrompt);
        addImageToHistory(dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`));
        addLog('✅ Ajuste aplicado con éxito.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al aplicar el ajuste: ${msg}`);
      addLog(`❌ Error de ajuste: ${msg}`);
    } finally {
      isRequestInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  const handleGeneratePhotoshoot = async (scenePrompt: string, numImages: number, sceneImage: File | null) => {
    if (isRequestInProgressRef.current) {
        addLog("⚠️ Petición ya en progreso. Por favor, espera.");
        return;
    }
    if (!currentImage) return;
    isRequestInProgressRef.current = true;
    setIsLoading(true);
    setError(null);
    exitPhotoshootMode();
    const logPrompt = sceneImage ? `[Imagen de fondo] + "${scenePrompt}"` : `"${scenePrompt}"`;
    addLog(`Iniciando sesión de fotos con Agente Experto: ${logPrompt} (${numImages} tomas).`);
    try {
        const results = await generatePhotoshootScene(currentImage, scenePrompt, numImages, sceneImage);
        setPhotoshootResults(results);
        setSelectedPhotoshootIndices(results.map((_, i) => i)); // Select all by default
        setFocusedPhotoshootIndex(0); // Focus on the first image
        setLastSelectedPhotoshootIndex(0);
        addLog(`✅ Sesión de fotos generada. ${results.length} imágenes listas para revisión.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al generar la sesión de fotos: ${msg}`);
      addLog(`❌ Error en sesión de fotos: ${msg}`);
    } finally {
      isRequestInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  const handleApplySinglePhotoshootEdit = async (
    editFunction: (image: File, prompt: string) => Promise<string>,
    prompt: string,
    type: 'ajuste' | 'filtro',
    index: number,
  ) => {
      if (!photoshootResults) return;
      setIsLoading(true);
      setError(null);
      addLog(`Aplicando ${type} a la imagen #${index + 1}...`);
      try {
          const sourceUrl = editedPhotoshootResults?.get(index) || photoshootResults[index];
          const sourceFile = dataURLtoFile(sourceUrl, `single_source_${index}.png`);
          
          const finalPrompt = await refineUserPrompt(prompt, type === 'ajuste' ? 'adjustment' : 'filter');
          addLog(`✨ Prompt refinado: "${finalPrompt}"`);

          const newImageUrl = await editFunction(sourceFile, finalPrompt);

          const newEditedResults = new Map(editedPhotoshootResults || []);
          newEditedResults.set(index, newImageUrl);
          setEditedPhotoshootResults(newEditedResults);
          addLog(`✅ ${type} aplicado con éxito a la imagen #${index + 1}.`);
      } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error desconocido';
          setError(`Fallo al aplicar ${type} a la imagen #${index + 1}: ${msg}`);
          addLog(`❌ Error en ${type} individual: ${msg}`);
      } finally {
          setIsLoading(false);
      }
  };
  
  const applySequentialEdit = async (
    editFunction: (image: File, prompt: string) => Promise<string>,
    prompt: string,
    type: 'ajuste' | 'filtro'
  ) => {
    if (isProcessingMultiple) {
        addLog("⚠️ Proceso secuencial ya en progreso.");
        return;
    }

    if (!photoshootResults || selectedPhotoshootIndices.length === 0) {
        setError("No hay imágenes seleccionadas en la sesión para editar.");
        return;
    }

    setIsProcessingMultiple(true);
    setSequentialProgress(`Iniciando ${type} en ${selectedPhotoshootIndices.length} imágenes...`);
    setError(null);
    addLog(`Iniciando ${type} secuencial en ${selectedPhotoshootIndices.length} imágenes...`);

    try {
        const currentEdits = editedPhotoshootResults || new Map<number, string>();
        const newEditedResults = new Map(currentEdits);
        
        const finalPrompt = await refineUserPrompt(prompt, type === 'ajuste' ? 'adjustment' : 'filter');
        addLog(`✨ Prompt refinado para el proceso: "${finalPrompt}"`);

        setSequentialProgress(`Prompt refinado. Esperando 5s para iniciar el proceso...`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        const indicesToProcess = [...selectedPhotoshootIndices].sort((a,b) => a-b); // Process in order

        for (let i = 0; i < indicesToProcess.length; i++) {
            const index = indicesToProcess[i];
            const progressMessage = `(${i + 1}/${indicesToProcess.length}) Procesando imagen #${index + 1}...`;
            setSequentialProgress(progressMessage);
            addLog(progressMessage);
            
            const sourceUrl = currentEdits.get(index) || photoshootResults[index];
            const sourceFile = dataURLtoFile(sourceUrl, `sequential_source_${index}.png`);
            
            const newImageUrl = await editFunction(sourceFile, finalPrompt);
            newEditedResults.set(index, newImageUrl);

            // Update state incrementally to show progress
            setEditedPhotoshootResults(new Map(newEditedResults));

            // User-requested 5-second delay
            if (i < indicesToProcess.length - 1) {
                setSequentialProgress(`Esperando 5s para la siguiente imagen...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); 
            }
        }

        addLog(`✅ Proceso secuencial de ${type} completado con éxito.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        const userFriendlyError = msg.includes('RESOURCE_EXHAUSTED')
            ? "Se ha alcanzado el límite de peticiones a la IA. El proceso se ha detenido. Inténtalo de nuevo en un momento o con menos imágenes."
            : `Fallo al aplicar el ${type} secuencial: ${msg}`;
        setError(userFriendlyError);
        addLog(`❌ Error en ${type} secuencial: ${msg}`);
    } finally {
        setIsProcessingMultiple(false);
        setSequentialProgress(null);
    }
  };

  const handlePhotoshootAdjustment = (prompt: string) => {
    if (selectedPhotoshootIndices.length === 0) {
        setError("Selecciona al menos una imagen para aplicar el ajuste.");
        return;
    }
    if (selectedPhotoshootIndices.length === 1) {
        handleApplySinglePhotoshootEdit(generateAdjustedImage, prompt, 'ajuste', selectedPhotoshootIndices[0]);
    } else {
        applySequentialEdit(generateAdjustedImage, prompt, 'ajuste');
    }
  };

  const handlePhotoshootFilter = (prompt: string) => {
      if (selectedPhotoshootIndices.length === 0) {
          setError("Selecciona al menos una imagen para aplicar el filtro.");
          return;
      }
      if (selectedPhotoshootIndices.length === 1) {
          handleApplySinglePhotoshootEdit(generateFilteredImage, prompt, 'filtro', selectedPhotoshootIndices[0]);
      } else {
          applySequentialEdit(generateFilteredImage, prompt, 'filtro');
      }
  };

  const handleApplyPhotoshootCrop = useCallback((croppedDataUrl: string) => {
      if (focusedPhotoshootIndex === null) return;
      
      const newEditedResults = new Map(editedPhotoshootResults || []);
      newEditedResults.set(focusedPhotoshootIndex, croppedDataUrl);
      setEditedPhotoshootResults(newEditedResults);
      addLog(`✅ Recorte aplicado con éxito a la imagen #${focusedPhotoshootIndex + 1}.`);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setActiveTab('adjust'); // Switch tab to see result clearly
  }, [focusedPhotoshootIndex, editedPhotoshootResults, addLog]);


  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Por favor, selecciona un área para recortar.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('No se pudo procesar el recorte.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    if (isPhotoshootMode) {
        handleApplyPhotoshootCrop(croppedImageUrl);
    } else {
        addImageToHistory(dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`));
    }
  }, [completedCrop, addImageToHistory, isPhotoshootMode, handleApplyPhotoshootCrop]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      clearExtraState(true);
    }
  }, [canUndo, historyIndex, clearExtraState]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      clearExtraState(true);
    }
  }, [canRedo, historyIndex, clearExtraState]);

  const handleReset = useCallback(() => {
    if (isPhotoshootMode) {
      exitPhotoshootMode();
    } else if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      clearExtraState();
    }
  }, [history, clearExtraState, isPhotoshootMode]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setMagicEditPrompt('');
      clearExtraState();
      setImageResolution(null);
      setAppMode('start');
  }, [clearExtraState]);
  
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = useCallback(() => {
      if (isPhotoshootMode) {
        if (focusedPhotoshootIndex !== null && photoshootResults) {
            const url = editedPhotoshootResults?.get(focusedPhotoshootIndex) || photoshootResults[focusedPhotoshootIndex];
            downloadDataUrl(url, `session_image_${focusedPhotoshootIndex + 1}.png`);
        }
      } else if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage, isPhotoshootMode, photoshootResults, editedPhotoshootResults, focusedPhotoshootIndex]);

  const handleDownloadSelected = async () => {
    if (!photoshootResults || selectedPhotoshootIndices.length === 0) return;
    addLog(`Iniciando descarga de ${selectedPhotoshootIndices.length} imágenes seleccionadas...`);
    const currentImageSet = photoshootResults.map((base, index) => editedPhotoshootResults?.get(index) || base);
    
    for (const index of selectedPhotoshootIndices) {
        downloadDataUrl(currentImageSet[index], `session_image_${index + 1}.png`);
        await new Promise(resolve => setTimeout(resolve, 300)); // Delay to prevent browser blocking
    }
    addLog(`✅ Descarga de ${selectedPhotoshootIndices.length} imágenes completa.`);
  };
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };
  
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (activeTab === 'magic-edit') {
      const canvas = maskCanvasRef.current;
      if (canvas) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          addLog(`Lienzo inicializado a la resolución nativa de la imagen: ${img.naturalWidth}x${img.naturalHeight}`);
          clearMask();
      }
    }
    setImageResolution({ width: img.naturalWidth, height: img.naturalHeight });
  }, [clearMask, addLog, activeTab]);
  
  const getCoords = useCallback((e: React.PointerEvent) => {
    if (!maskCanvasRef.current || !imgRef.current) return null;
    const { scale, positionX, positionY } = transformStateRef.current;
    const canvas = maskCanvasRef.current;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();

    const contentX = (e.clientX - rect.left - positionX) / scale;
    const contentY = (e.clientY - rect.top - positionY) / scale;
    
    const scaleRatio = canvas.width / img.clientWidth;
    const bufferX = contentX * scaleRatio;
    const bufferY = contentY * scaleRatio;
    
    return { x: bufferX, y: bufferY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeTab !== 'magic-edit' || !maskCanvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCoords(e);
    if (coords) {
      lastPointRef.current = coords;
      const ctx = maskCanvasRef.current.getContext('2d');
      if (ctx) {
        const scaleRatio = maskCanvasRef.current.width / (imgRef.current?.clientWidth ?? 1);
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, (brushSize / 2) * scaleRatio, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.globalCompositeOperation = brushMode === 'brush' ? 'source-over' : 'destination-out';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }, [activeTab, getCoords, brushSize, brushMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
    if (!isDrawing || !maskCanvasRef.current || !imgRef.current) return;

    const coords = getCoords(e);
    if (coords && lastPointRef.current) {
        const ctx = maskCanvasRef.current.getContext('2d');
        if (ctx) {
            const scaleRatio = maskCanvasRef.current.width / imgRef.current.clientWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = brushSize * scaleRatio;
            ctx.strokeStyle = 'white';
            ctx.globalCompositeOperation = brushMode === 'brush' ? 'source-over' : 'destination-out';
            
            ctx.beginPath();
            ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            lastPointRef.current = coords;
        }
    }
  }, [isDrawing, getCoords, brushSize, brushMode]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    lastPointRef.current = null;
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
        setHasMask(imageData.data.some((channel, i) => (i + 1) % 4 === 0 && channel > 0));
      }
    }
  }, []);

  const handleTogglePhotoshootSelection = (indexToToggle: number) => {
    setSelectedPhotoshootIndices(prev => {
        if (prev.includes(indexToToggle)) {
            return prev.filter(i => i !== indexToToggle);
        } else {
            return [...prev, indexToToggle];
        }
    });
  };

  const handlePhotoshootImageClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();

    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isShift && lastSelectedPhotoshootIndex !== null) {
        const start = Math.min(lastSelectedPhotoshootIndex, index);
        const end = Math.max(lastSelectedPhotoshootIndex, index);
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setSelectedPhotoshootIndices(prev => [...new Set([...prev, ...range])]);
    } else if (isCmdOrCtrl) {
        handleTogglePhotoshootSelection(index);
    } else {
        setFocusedPhotoshootIndex(index);
        setSelectedPhotoshootIndices([index]);
    }
    setLastSelectedPhotoshootIndex(index);
  };

  const handleRemovePhotoshootImage = (indexToRemove: number) => {
    const newResults = photoshootResults ? [...photoshootResults] : [];
    newResults.splice(indexToRemove, 1);
    
    if (newResults.length === 0) {
        exitPhotoshootMode();
        return;
    }

    const newEdited = editedPhotoshootResults ? new Map(editedPhotoshootResults) : new Map();
    newEdited.delete(indexToRemove);
    const shiftedEdited = new Map<number, string>();
    for(const [key, value] of newEdited.entries()){
        if(key > indexToRemove) {
            shiftedEdited.set(key - 1, value);
        } else {
            shiftedEdited.set(key, value);
        }
    }
    
    if (focusedPhotoshootIndex === indexToRemove) {
        setFocusedPhotoshootIndex(Math.max(0, indexToRemove - 1));
    } else if (focusedPhotoshootIndex !== null && focusedPhotoshootIndex > indexToRemove) {
        setFocusedPhotoshootIndex(focusedPhotoshootIndex - 1);
    }
    
    setPhotoshootResults(newResults);
    setEditedPhotoshootResults(shiftedEdited.size > 0 ? shiftedEdited : null);
    setSelectedPhotoshootIndices(prev => prev.filter(i => i !== indexToRemove).map(i => i > indexToRemove ? i - 1 : i));
  };
  

  const renderPhotoEditor = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">Ocurrió un Error</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => {
                  setError(null);
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Intentar de Nuevo
            </button>
          </div>
        );
    }
    
    if (!currentImage && !isPhotoshootMode) {
      return <div>Error: No image loaded for editor.</div>
    }

    const imageViewer = (
        <div className="relative w-full h-full">
            <TransformWrapper
                ref={transformRef}
                onTransformed={(_ref, state) => transformStateRef.current = state}
                panning={{ 
                  activationKeys: ['Alt'], 
                  disabled: activeTab !== 'magic-edit' || isLoading,
                  excluded: ['button', 'input', 'textarea']
                }}
                wheel={{ disabled: activeTab !== 'magic-edit' || isLoading }}
                doubleClick={{ disabled: true }}
                minScale={0.5}
                maxScale={10}
                initialScale={1}
                limitToBounds={true}
            >
              <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                <div className="relative">
                  {originalImageUrl && !isPhotoshootMode && (
                      <img
                          key={`original-${originalImageUrl}`}
                          src={originalImageUrl}
                          alt="Original"
                          className="w-full h-auto object-contain max-h-[inherit] rounded-xl pointer-events-none"
                      />
                  )}
                  <img
                      ref={imgRef}
                      onLoad={handleImageLoad}
                      key={`current-${currentImageUrl}`}
                      src={currentImageUrl ?? ''}
                      alt="Current"
                      className={`w-full h-auto object-contain max-h-[inherit] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${isPhotoshootMode ? '' : 'absolute top-0 left-0'} pointer-events-none`}
                  />
                  
                    <>
                      <canvas
                        ref={maskCanvasRef}
                        className="absolute top-0 left-0 w-full h-full opacity-50 bg-blend-overlay pointer-events-none"
                        style={{ cursor: activeTab === 'magic-edit' ? 'none' : 'default' }}
                      />
                      <div
                          className="absolute top-0 left-0 w-full h-full"
                          style={{ cursor: activeTab === 'magic-edit' ? 'none' : 'default' }}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerLeave={(e) => {
                            handlePointerUp(e);
                            setIsImageViewerHovered(false);
                          }}
                          onMouseEnter={() => setIsImageViewerHovered(true)}
                      />
                    </>
                  
                </div>
              </TransformComponent>
              {activeTab === 'magic-edit' && <ZoomControls />}
            </TransformWrapper>
        </div>
    );
    
    const cropViewer = (
      <ReactCrop 
        crop={crop} 
        onChange={c => setCrop(c)} 
        onComplete={c => setCompletedCrop(c)}
        aspect={aspect}
        className="max-h-full"
      >
        <img 
          ref={imgRef}
          key={`crop-${currentImageUrl}`}
          src={currentImageUrl ?? ''} 
          alt="Crop this image"
          onLoad={handleImageLoad}
          className="w-full h-auto object-contain max-h-[inherit] rounded-xl"
        />
      </ReactCrop>
    );

    const photoshootCarousel = () => {
        const displayResults = photoshootResults || [];
        const currentImageSet = displayResults.map((base, index) => editedPhotoshootResults?.get(index) || base);

        return (
            <div className="w-full flex-shrink-0">
                <p className="text-center text-sm text-gray-400 mb-2">Sesión de Fotos: Clic para seleccionar, Cmd/Ctrl+Clic para selección múltiple, Shift+Clic para rango.</p>
                <div className="flex items-center gap-3 overflow-x-auto p-2 bg-black/20 rounded-lg">
                    {currentImageSet.map((imageUrl, index) => {
                        const isSelected = selectedPhotoshootIndices.includes(index);
                        const isFocused = focusedPhotoshootIndex === index;
                        return (
                          <div key={index} className="relative flex-shrink-0 group">
                              <img 
                                src={imageUrl} 
                                alt={`Photoshoot result ${index + 1}`} 
                                className={`w-24 h-24 object-cover rounded-md cursor-pointer transition-all duration-200 ${isFocused ? 'ring-4 ring-blue-500' : 'ring-2 ring-transparent'}`}
                                onClick={(e) => handlePhotoshootImageClick(e, index)}
                              />
                              <div 
                                  className={`absolute inset-0 rounded-md transition-all duration-200 pointer-events-none ${isSelected ? 'ring-4 ring-blue-500 ring-inset' : ''}`}
                              >
                                  <div 
                                    className="absolute top-1 left-1 pointer-events-auto cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); handleTogglePhotoshootSelection(index); }}
                                    title="Seleccionar para edición en lote"
                                  >
                                      {isSelected 
                                          ? <CheckCircleIcon className="w-6 h-6 text-blue-400 bg-gray-900/80 rounded-full" />
                                          : <div className="w-6 h-6 rounded-full border-2 border-white/50 bg-gray-900/50 group-hover:border-white transition-colors" />
                                      }
                                  </div>
                              </div>
                              <button 
                                  onClick={() => handleRemovePhotoshootImage(index)}
                                  className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                  title="Eliminar esta imagen de la sesión"
                              >
                                  <XCircleIcon className="w-4 h-4"/>
                              </button>
                          </div>
                        )
                    })}
                </div>
            </div>
        )
    };


    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="w-full shadow-2xl rounded-xl select-none flex flex-col gap-4 flex-grow min-h-0">
            {isPhotoshootMode && photoshootCarousel()}
            
            <div className="relative flex-grow bg-black/20 rounded-lg overflow-hidden flex items-center justify-center min-h-[200px]">
              {isProcessingMultiple && (
                  <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                      <Spinner className="animate-spin h-16 w-16 text-white" />
                      <p className="text-gray-300">{sequentialProgress || 'Procesando imágenes...'}</p>
                  </div>
              )}
              {isLoading && (
                  <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                      <Spinner className="animate-spin h-16 w-16 text-white" />
                  </div>
              )}
              
              { activeTab === 'crop' ? cropViewer : imageViewer }

              {imageResolution && !isLoading && (
                <div className="absolute bottom-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white text-xs font-mono py-1 px-2 rounded-md border border-white/20">
                    {imageResolution.width} x {imageResolution.height}
                </div>
              )}
              
              {isImageViewerHovered && activeTab === 'magic-edit' && !isLoading &&(
                <div
                  className={`fixed rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-50 transition-transform duration-100 ease-out ${isDrawing ? 'scale-90' : 'scale-100'}`}
                  style={{ 
                      left: cursorPos.x, top: cursorPos.y, width: brushSize, height: brushSize, 
                      border: brushMode === 'erase' ? '2px solid red' : '2px solid white',
                      background: brushMode === 'erase' ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,0,0.2)',
                  }}
                />
              )}
            </div>
        </div>
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm">
            {(Object.keys(tabTooltips) as Tab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    title={tabTooltips[tab]}
                    className={`w-full capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === tab 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {
                        {
                            'magic-edit': 'Edición Mágica',
                            'adjust': 'Ajustes',
                            'filters': 'Filtros',
                            'crop': 'Recortar',
                            'photoshoot': 'Sesión de Fotos'
                        }[tab]
                    }
                </button>
            ))}
        </div>
        
        <div className="w-full">
            {activeTab === 'magic-edit' && (
              <MagicEditPanel 
                prompt={magicEditPrompt}
                setPrompt={setMagicEditPrompt}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                featherSize={featherSize}
                setFeatherSize={setFeatherSize}
                brushMode={brushMode}
                setBrushMode={setBrushMode}
                onClearMask={clearMask}
                onGenerate={handleGenerate}
                isLoading={isLoading}
                hasMask={hasMask}
                referenceImage={referenceImage}
                onReferenceImageSelect={(file) => setReferenceImage(file)}
                onClearReferenceImage={() => setReferenceImage(null)}
                enhancePrompt={enhanceMagicEditPrompt}
                setEnhancePrompt={setEnhanceMagicEditPrompt}
              />
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={isPhotoshootMode ? handlePhotoshootAdjustment : handleApplyAdjustment} isLoading={isLoading || isProcessingMultiple} currentImage={isPhotoshootMode ? (focusedPhotoshootIndex !== null ? dataURLtoFile(photoshootResults![focusedPhotoshootIndex], 'focused.png') : null) : currentImage} isPhotoshootMode={isPhotoshootMode} selectionCount={selectedPhotoshootIndices.length} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={isPhotoshootMode ? handlePhotoshootFilter : handleApplyFilter} isLoading={isLoading || isProcessingMultiple} currentImage={isPhotoshootMode ? (focusedPhotoshootIndex !== null ? dataURLtoFile(photoshootResults![focusedPhotoshootIndex], 'focused.png') : null) : currentImage} isPhotoshootMode={isPhotoshootMode} selectionCount={selectedPhotoshootIndices.length} />}
            {activeTab === 'photoshoot' && (
              <PhotoshootPanel 
                onGenerate={handleGeneratePhotoshoot} 
                isLoading={isLoading}
              />
            )}
        </div>

        {logs.length > 0 && <LogPanel logs={logs} onClear={() => setLogs([])} />}
        
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button 
                onClick={handleUndo}
                disabled={!canUndo || isPhotoshootMode}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Undo last action"
                title="Deshacer la última acción (Ctrl+Z)"
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                Deshacer
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo || isPhotoshootMode}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Redo last action"
                title="Rehacer la última acción (Ctrl+Y)"
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                Rehacer
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            {canUndo && !isPhotoshootMode && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                  aria-label="Press and hold to see original image"
                  title="Mantén presionado para ver la imagen original"
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  Comparar
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={historyIndex === 0 && !isPhotoshootMode}
                className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
                title="Descartar todos los cambios y volver a la imagen original"
              >
                {isPhotoshootMode ? 'Salir de la Sesión' : 'Reiniciar'}
            </button>
            <button 
                onClick={handleUploadNew}
                className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                title="Descartar todo y volver a la pantalla de inicio"
            >
                Empezar de Nuevo
            </button>

            <div className="flex-grow flex justify-end gap-3">
              {isPhotoshootMode && (
                <button 
                  onClick={handleDownloadSelected}
                  disabled={!photoshootResults || selectedPhotoshootIndices.length === 0}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Descargar las ${selectedPhotoshootIndices.length} imágenes seleccionadas.`}
                >
                    <DownloadIcon className="w-5 h-5 mr-2" />
                    Descargar Selección ({selectedPhotoshootIndices.length})
                </button>
              )}
              <button 
                  onClick={handleDownload}
                  disabled={isPhotoshootMode && focusedPhotoshootIndex === null}
                  className="flex items-center justify-center bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-gray-600 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                  title={isPhotoshootMode ? "Descargar la imagen enfocada." : "Descargar la imagen actual a tu dispositivo."}
              >
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Descargar Imagen
              </button>
            </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (appMode) {
      case 'photo-editor':
        return renderPhotoEditor();
      case 'story-builder':
        return <StoryBuilder onExit={() => setAppMode('start')} importedProject={importedProject} />;
      case 'start':
      default:
        return <StartScreen 
          onStartPhotoEditor={(files) => {
            if (files && files[0]) {
              handleImageUpload(files[0]);
            }
          }}
          onStartStoryBuilder={() => {
              setImportedProject(null); // Clear any previous imports
              setAppMode('story-builder');
          }}
          onProjectImport={handleProjectImport}
        />;
    }
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex flex-col justify-start items-center`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;