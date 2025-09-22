/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import type { CharacterDefinition, CharacterRelationship, CharacterMotivation } from './types';
import { UploadIcon, XCircleIcon, SparkleIcon } from '../icons';
import { assetDBService } from '../../services/assetDBService';
import { logger } from '../../utils/logger';
import { COST_OPTIMIZATION_CONFIG } from './constants';
import { suggestCharacterRelationships } from '../../services/geminiService';
import Spinner from '../Spinner';

interface Phase3_CharactersProps {
    onComplete: (data: CharacterDefinition[]) => void;
    initialData: CharacterDefinition[];
    onBack: () => void;
    onAssistCharacter: (charId: string) => Promise<void>;
    onAssistNewCharacter: (charData: Partial<CharacterDefinition>) => Promise<Partial<CharacterDefinition>>;
    assistingCharacterIds: Set<string>;
}

const defaultMotivation: CharacterMotivation = { desire: '', fear: '', need: '' };
const getNewChar = (): CharacterDefinition => ({ 
    id: `char_${Date.now()}`, 
    name: '', 
    description: '', 
    archetype: '',
    role: 'Supporting',
    motivation: {...defaultMotivation},
    flaw: '',
    arc: '',
    relationships: [],
    visual_prompt_enhancers: '',
});


const Phase3_Characters: React.FC<Phase3_CharactersProps> = ({ onComplete, initialData, onBack, onAssistCharacter, onAssistNewCharacter, assistingCharacterIds }) => {
    const [characters, setCharacters] = useState<CharacterDefinition[]>([]);
    const [newChar, setNewChar] = useState<CharacterDefinition>(getNewChar());
    const [isAssistingNew, setIsAssistingNew] = useState(false);
    const [isSuggestingRels, setIsSuggestingRels] = useState(false);

    useEffect(() => {
        const loadInitialCharacters = async () => {
            if (initialData && initialData.length > 0) {
                const charactersWithImageUrls = await Promise.all(
                    initialData.map(async (char) => {
                        let imageUrl = char.imageUrl;
                        if (char.imageAssetId && !imageUrl) {
                            try {
                                const blob = await assetDBService.loadAsset(char.imageAssetId);
                                if (blob) imageUrl = URL.createObjectURL(blob);
                            } catch (error) {
                                logger.log('ERROR', 'Phase3', `Failed to load image for ${char.name}`, error);
                            }
                        }
                        return { ...char, imageUrl };
                    })
                );
                setCharacters(charactersWithImageUrls);
            }
        };
        loadInitialCharacters();
    }, [initialData]);

    useEffect(() => {
        return () => {
            characters.forEach(char => {
                if (char.imageUrl && char.imageUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(char.imageUrl);
                }
            });
            if (newChar.imageUrl && newChar.imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(newChar.imageUrl);
            }
        };
    }, [characters, newChar.imageUrl]);


    const handleAddCharacter = async () => {
        if (characters.length >= COST_OPTIMIZATION_CONFIG.maxCharactersPerProject) {
            alert(`Para optimizar los costos, el número de personajes está limitado a ${COST_OPTIMIZATION_CONFIG.maxCharactersPerProject}.`);
            return;
        }

        if (newChar.name.trim() && newChar.description.trim()) {
            let characterToAdd = { ...newChar };
            if (newChar.imageFile) {
                try {
                    const assetId = `char_ref_${newChar.name.replace(/\s+/g, '_')}_${Date.now()}`;
                    await assetDBService.saveAsset(assetId, newChar.imageFile);
                    characterToAdd.imageAssetId = assetId;
                } catch (error) {
                     logger.log('ERROR', 'Phase3', `Failed to save character image for ${newChar.name}`, error);
                     alert("Hubo un error al guardar la imagen de referencia. Por favor, inténtalo de nuevo.");
                     return;
                }
            }
            
            setCharacters(prev => [...prev, characterToAdd]);
            setNewChar(getNewChar()); // Reset form
        } else {
            alert("Por favor, introduce al menos un nombre y una descripción para el personaje.");
        }
    };

    const handleRemoveCharacter = (id: string) => {
        const charToRemove = characters.find(c => c.id === id);
        if (charToRemove?.imageUrl && charToRemove.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(charToRemove.imageUrl);
        }
        setCharacters(prev => prev.filter(c => c.id !== id));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (newChar.imageUrl && newChar.imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(newChar.imageUrl);
            }
            setNewChar(prev => ({ 
                ...prev, 
                imageFile: file, 
                imageUrl: URL.createObjectURL(file) 
            }));
        }
    };

    const handleRelationshipChange = (charId: string, relIndex: number, field: keyof CharacterRelationship, value: string) => {
        setCharacters(chars => chars.map(c => {
            if (c.id === charId) {
                const newRels = [...c.relationships];
                newRels[relIndex] = {...newRels[relIndex], [field]: value};
                return {...c, relationships: newRels};
            }
            return c;
        }));
    };

    const addRelationship = (charId: string) => {
        setCharacters(chars => chars.map(c => {
            if (c.id === charId) {
                const newRels = [...c.relationships, {characterId: '', relationshipType: ''}];
                return {...c, relationships: newRels};
            }
            return c;
        }));
    }
    
    const removeRelationship = (charId: string, relIndex: number) => {
        setCharacters(chars => chars.map(c => {
            if (c.id === charId) {
                const newRels = c.relationships.filter((_, i) => i !== relIndex);
                return {...c, relationships: newRels};
            }
            return c;
        }));
    }
    
    // FIX: This now calls the centralized action from the state machine hook.
    const handleAssistNewCharacter = async () => {
        setIsAssistingNew(true);
        try {
            const result = await onAssistNewCharacter(newChar);
            setNewChar(prev => ({ ...prev, ...result, motivation: {...prev.motivation, ...result.motivation} }));
        } catch (e) {
            alert(`Error de la IA: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsAssistingNew(false);
        }
    };

    const handleSuggestRelationships = async () => {
        setIsSuggestingRels(true);
        try {
            const updatedCharacters = await suggestCharacterRelationships(characters);
            setCharacters(updatedCharacters);
        } catch(e) {
            alert(`Error de la IA al sugerir relaciones: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsSuggestingRels(false);
        }
    }

    const canProceed = characters.length > 0;
    const isAtLimit = characters.length >= COST_OPTIMIZATION_CONFIG.maxCharactersPerProject;

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-blue-300">Fase 3: Personajes (Cadena de Agentes)</h2>
            <p className="text-gray-400">Define los agentes narrativos de tu historia. Cada personaje es un nodo en la red. Usa la asistencia de IA para acelerar el proceso.</p>
            
            {/* --- Formulario de Nuevo Personaje --- */}
            <div className={`bg-gray-900/50 p-4 rounded-lg border border-gray-700 space-y-4 ${isAtLimit ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">{isAtLimit ? "Límite de Personajes Alcanzado" : "Añadir Nuevo Agente Narrativo"}</h3>
                     <button onClick={handleAssistNewCharacter} disabled={isAssistingNew} className="flex items-center gap-2 bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-sm hover:bg-yellow-500 transition-colors disabled:bg-yellow-800">
                        {isAssistingNew ? <Spinner className="w-4 h-4" /> : <SparkleIcon className="w-4 h-4" />}
                        {isAssistingNew ? 'Creando...' : 'Asistencia IA'}
                     </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="text" placeholder="* Nombre del Personaje" value={newChar.name} onChange={e => setNewChar(p => ({...p, name: e.target.value}))} className="bg-gray-800 p-2 rounded border border-gray-600"/>
                    <select value={newChar.role} onChange={e => setNewChar(p => ({...p, role: e.target.value as CharacterDefinition['role']}))} className="bg-gray-800 p-2 rounded border border-gray-600">
                        {['Protagonist', 'Antagonist', 'Mentor', 'Ally', 'Foil', 'Supporting', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input type="text" placeholder="Arquetipo (ej. El Rebelde)" value={newChar.archetype} onChange={e => setNewChar(p => ({...p, archetype: e.target.value}))} className="bg-gray-800 p-2 rounded border border-gray-600"/>
                </div>
                <textarea placeholder="* Descripción (apariencia, personalidad, rol)" rows={3} value={newChar.description} onChange={e => setNewChar(p => ({...p, description: e.target.value}))} className="w-full bg-gray-800 p-2 rounded border border-gray-600"/>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <input type="text" placeholder="Deseo (¿Qué quiere?)" value={newChar.motivation.desire} onChange={e => setNewChar(p => ({...p, motivation: {...p.motivation, desire: e.target.value}}))} className="bg-gray-800 p-2 rounded border border-gray-600"/>
                    <input type="text" placeholder="Miedo (¿Qué teme?)" value={newChar.motivation.fear} onChange={e => setNewChar(p => ({...p, motivation: {...p.motivation, fear: e.target.value}}))} className="bg-gray-800 p-2 rounded border border-gray-600"/>
                    <input type="text" placeholder="Necesidad (¿Qué debe aprender?)" value={newChar.motivation.need} onChange={e => setNewChar(p => ({...p, motivation: {...p.motivation, need: e.target.value}}))} className="bg-gray-800 p-2 rounded border border-gray-600"/>
                </div>
                <input type="text" placeholder="Defecto Crítico (ej. Arrogancia, Indecisión)" value={newChar.flaw} onChange={e => setNewChar(p => ({...p, flaw: e.target.value}))} className="w-full bg-gray-800 p-2 rounded border border-gray-600"/>
                <input type="text" placeholder="Arco Narrativo (ej. De egoísta a líder)" value={newChar.arc} onChange={e => setNewChar(p => ({...p, arc: e.target.value}))} className="w-full bg-gray-800 p-2 rounded border border-gray-600"/>
                <input type="text" placeholder="Enhancers Visuales (ej. pelo rojo, tatuaje de dragón)" value={newChar.visual_prompt_enhancers} onChange={e => setNewChar(p => ({...p, visual_prompt_enhancers: e.target.value}))} className="w-full bg-gray-800 p-2 rounded border border-gray-600"/>

                <div className="flex items-center gap-4">
                    <label htmlFor="char-img-upload" className="cursor-pointer bg-gray-700 p-2 rounded flex items-center gap-2 hover:bg-gray-600">
                        <UploadIcon className="w-5 h-5" />
                        <span>Subir Referencia Visual</span>
                    </label>
                    <input id="char-img-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>
                    {newChar.imageUrl && <img src={newChar.imageUrl} alt="preview" className="w-12 h-12 rounded object-cover" />}
                </div>
                <button onClick={handleAddCharacter} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded">Añadir Personaje</button>
            </div>
            
            {/* --- Lista de Personajes --- */}
            <div className="space-y-3">
                 <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Personajes Definidos ({characters.length} / {COST_OPTIMIZATION_CONFIG.maxCharactersPerProject})</h3>
                    <button onClick={handleSuggestRelationships} disabled={isSuggestingRels || characters.length < 2} className="flex items-center gap-2 bg-purple-600 text-white font-bold py-2 px-3 rounded-lg text-sm hover:bg-purple-500 transition-colors disabled:bg-purple-800">
                        {isSuggestingRels ? <Spinner className="w-4 h-4" /> : '🤝'}
                        {isSuggestingRels ? 'Pensando...' : 'Sugerir Relaciones IA'}
                     </button>
                </div>
                {characters.length === 0 && <p className="text-sm text-gray-400">Aún no has añadido ningún personaje.</p>}
                {characters.map((char) => {
                    const isAssisting = assistingCharacterIds.has(char.id);
                    return (
                        <div key={char.id} className="bg-gray-800/80 p-3 rounded-lg flex items-start gap-4">
                            {char.imageUrl && <img src={char.imageUrl} alt={char.name} className="w-24 h-24 rounded object-cover flex-shrink-0" />}
                            <div className="flex-grow space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg">{char.name} <span className="text-base font-normal text-blue-300">({char.role})</span></h4>
                                        <p className="text-sm text-gray-300">{char.description}</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                         <button onClick={() => onAssistCharacter(char.id)} disabled={isAssisting} className="flex items-center gap-1.5 bg-yellow-600 text-white font-bold py-1 px-2 rounded-lg text-xs hover:bg-yellow-500 transition-colors disabled:bg-yellow-800">
                                            {isAssisting ? <Spinner className="w-3 h-3" /> : <SparkleIcon className="w-3 h-3" />}
                                         </button>
                                        <button onClick={() => handleRemoveCharacter(char.id)} className="text-red-400 hover:text-red-300 flex-shrink-0"><XCircleIcon className="w-6 h-6"/></button>
                                    </div>
                                </div>
                                <div className="text-xs space-y-1 bg-black/20 p-2 rounded">
                                    <p><strong>Arco:</strong> {char.arc || 'N/D'}</p>
                                    <p><strong>Defecto:</strong> {char.flaw || 'N/D'}</p>
                                    <p><strong>Visual:</strong> {char.visual_prompt_enhancers || 'N/D'}</p>
                                </div>
                                <div>
                                    <h5 className="font-semibold text-sm mb-1">Relaciones:</h5>
                                    {char.relationships.map((rel, relIndex) => (
                                        <div key={relIndex} className="flex items-center gap-2 mb-1">
                                            <select value={rel.characterId} onChange={(e) => handleRelationshipChange(char.id, relIndex, 'characterId', e.target.value)} className="bg-gray-700 p-1 rounded text-xs">
                                                <option value="">Seleccionar...</option>
                                                {characters.filter(c => c.id !== char.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <span>es</span>
                                            <input type="text" placeholder="Tipo (ej. Rival)" value={rel.relationshipType} onChange={(e) => handleRelationshipChange(char.id, relIndex, 'relationshipType', e.target.value)} className="bg-gray-700 p-1 rounded text-xs flex-grow" />
                                            <button onClick={() => removeRelationship(char.id, relIndex)} className="text-red-500 text-xs">X</button>
                                        </div>
                                    ))}
                                    <button onClick={() => addRelationship(char.id)} className="text-xs bg-blue-800 hover:bg-blue-700 px-2 py-1 rounded">+ Añadir Relación</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                 <button onClick={onBack} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500">Atrás</button>
                <button onClick={() => onComplete(characters)} disabled={!canProceed} className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed">
                    {canProceed ? 'Continuar a Estructura' : 'Añade al menos un personaje'}
                </button>
            </div>
        </div>
    );
};

export default Phase3_Characters;
