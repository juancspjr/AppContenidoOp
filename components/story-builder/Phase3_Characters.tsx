/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import type { CharacterDefinition, CharacterMotivation, CharacterRelationship } from './types';
import { SparkleIcon, UploadIcon, XCircleIcon } from '../icons';
import { assetDBService } from '../../services/assetDBService';
import { logger } from '../../utils/logger';
import Spinner from '../Spinner';
import { v4 as uuidv4 } from 'uuid';

interface Phase3_CharactersProps {
    onComplete: (data: CharacterDefinition[]) => void;
    initialData: CharacterDefinition[];
    onBack: () => void;
    onAssistCharacter: (characterId: string) => Promise<void>;
    onAssistNewCharacter: (character: CharacterDefinition) => Promise<void>;
    assistingCharacterIds: Set<string>;
    areKeysConfigured: boolean;
}

const CharacterEditor: React.FC<{
    character: CharacterDefinition;
    onUpdate: (updatedCharacter: CharacterDefinition) => void;
    onClose: () => void;
    allCharacters: CharacterDefinition[];
}> = ({ character, onUpdate, onClose, allCharacters }) => {
    const [editedChar, setEditedChar] = useState(character);
    const [imageUrl, setImageUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        const loadImage = async () => {
            if (editedChar.imageAssetId) {
                const blob = await assetDBService.loadAsset(editedChar.imageAssetId);
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setImageUrl(objectUrl);
                }
            } else if (editedChar.imageFile) {
                objectUrl = URL.createObjectURL(editedChar.imageFile);
                setImageUrl(objectUrl);
            } else {
                setImageUrl('');
            }
        };
        loadImage();
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [editedChar.imageAssetId, editedChar.imageFile]);

    const handleChange = (field: keyof CharacterDefinition | `motivation.${keyof CharacterMotivation}`, value: any) => {
        if (typeof field === 'string' && field.startsWith('motivation.')) {
            const motivationField = field.split('.')[1] as keyof CharacterMotivation;
            setEditedChar(prev => ({
                ...prev,
                motivation: { ...prev.motivation, [motivationField]: value }
            }));
        } else {
            // FIX: Cast field to string to satisfy TypeScript's computed property key constraints.
            setEditedChar(prev => ({ ...prev, [field as string]: value }));
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const assetId = `char_img_${editedChar.id}`;
            await assetDBService.saveAsset(assetId, file);
            setEditedChar(prev => ({ ...prev, imageFile: file, imageAssetId: assetId, imageUrl: '' }));
        }
    };

    const handleSave = () => {
        onUpdate(editedChar);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">Editar Personaje</h3>
                <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="w-32 h-32 bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer relative group" onClick={() => fileInputRef.current?.click()}>
                        {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover rounded-lg" /> : <UploadIcon className="w-10 h-10 text-gray-400" />}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-sm">Cambiar Imagen</p>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>
                    {/* Form Fields */}
                    <input type="text" value={editedChar.name} onChange={e => handleChange('name', e.target.value)} placeholder="Nombre" className="w-full bg-gray-900 p-2 rounded" />
                    <select value={editedChar.role} onChange={e => handleChange('role', e.target.value)} className="w-full bg-gray-900 p-2 rounded">
                        {['Protagonist', 'Antagonist', 'Mentor', 'Ally', 'Foil', 'Supporting', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <textarea value={editedChar.description} onChange={e => handleChange('description', e.target.value)} placeholder="Descripción" rows={3} className="w-full bg-gray-900 p-2 rounded" />
                    <input type="text" value={editedChar.motivation.desire} onChange={e => handleChange('motivation.desire', e.target.value)} placeholder="Deseo (Lo que quiere)" className="w-full bg-gray-900 p-2 rounded" />
                    <input type="text" value={editedChar.motivation.fear} onChange={e => handleChange('motivation.fear', e.target.value)} placeholder="Miedo (Lo que teme)" className="w-full bg-gray-900 p-2 rounded" />
                    <input type="text" value={editedChar.motivation.need} onChange={e => handleChange('motivation.need', e.target.value)} placeholder="Necesidad (Lo que necesita aprender)" className="w-full bg-gray-900 p-2 rounded" />
                    <input type="text" value={editedChar.flaw} onChange={e => handleChange('flaw', e.target.value)} placeholder="Defecto Crítico" className="w-full bg-gray-900 p-2 rounded" />
                    <input type="text" value={editedChar.arc} onChange={e => handleChange('arc', e.target.value)} placeholder="Arco del Personaje (ej. 'De cobarde a héroe')" className="w-full bg-gray-900 p-2 rounded" />
                    <textarea value={editedChar.visual_prompt_enhancers} onChange={e => handleChange('visual_prompt_enhancers', e.target.value)} placeholder="Detalles visuales para la IA (ej. 'pelo rojo, cicatriz en el ojo')" rows={2} className="w-full bg-gray-900 p-2 rounded" />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onClose} className="bg-gray-600 px-4 py-2 rounded">Cancelar</button>
                    <button onClick={handleSave} className="bg-blue-600 px-4 py-2 rounded">Guardar</button>
                </div>
            </div>
        </div>
    );
};

const Phase3_Characters: React.FC<Phase3_CharactersProps> = ({ onComplete, initialData, onBack, onAssistCharacter, onAssistNewCharacter, assistingCharacterIds, areKeysConfigured }) => {
    const [characters, setCharacters] = useState<CharacterDefinition[]>(initialData || []);
    const [editingCharacter, setEditingCharacter] = useState<CharacterDefinition | null>(null);

    useEffect(() => {
        setCharacters(initialData || []);
    }, [initialData]);

    const createNewCharacter = (): CharacterDefinition => ({
        id: uuidv4(),
        name: '',
        description: '',
        role: 'Supporting',
        motivation: { desire: '', fear: '', need: '' },
        flaw: '',
        arc: '',
        relationships: [],
        visual_prompt_enhancers: '',
    });

    const handleAddCharacter = () => {
        setEditingCharacter(createNewCharacter());
    };

    const handleAssistNew = async () => {
        const newChar = createNewCharacter();
        newChar.name = "Nuevo Personaje (Generado por IA)";
        await onAssistNewCharacter(newChar);
    };

    const handleUpdateCharacter = (updatedCharacter: CharacterDefinition) => {
        setCharacters(prev => {
            const exists = prev.some(c => c.id === updatedCharacter.id);
            if (exists) {
                return prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c);
            }
            return [...prev, updatedCharacter];
        });
    };

    const handleDeleteCharacter = (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este personaje?")) {
            setCharacters(prev => prev.filter(c => c.id !== id));
        }
    };
    
    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold text-blue-300">Fase 3: Personajes</h2>
            <p className="text-gray-400">Define los personajes de tu historia. Un buen elenco es clave para una narrativa atractiva.</p>

            <div className="space-y-4">
                {characters.map(char => {
                    const isAssisting = assistingCharacterIds.has(char.id);
                    return (
                        <div key={char.id} className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 flex items-center gap-4">
                            <div className="flex-grow">
                                <h4 className="font-bold text-gray-200">{char.name} <span className="text-sm font-normal text-gray-400">({char.role})</span></h4>
                                <p className="text-xs text-gray-400 truncate">{char.description}</p>
                            </div>
                            <button onClick={() => onAssistCharacter(char.id)} disabled={isAssisting || !areKeysConfigured} className="flex items-center gap-1 text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-500 disabled:bg-yellow-800">
                                {isAssisting ? <Spinner className="w-4 h-4" /> : <SparkleIcon className="w-4 h-4" />}
                                Asistir
                            </button>
                            <button onClick={() => setEditingCharacter(char)} className="text-xs bg-blue-600 px-3 py-1 rounded hover:bg-blue-500">Editar</button>
                            <button onClick={() => handleDeleteCharacter(char.id)} className="text-red-400 hover:text-red-300"><XCircleIcon className="w-6 h-6" /></button>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleAddCharacter} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-500">Añadir Personaje Manualmente</button>
                <button onClick={handleAssistNew} disabled={assistingCharacterIds.has('new') || !areKeysConfigured} className="flex items-center justify-center gap-2 bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-500 disabled:bg-yellow-800">
                     {assistingCharacterIds.has('new') ? <Spinner className="w-5 h-5" /> : <SparkleIcon className="w-5 h-5" />}
                    Generar Personaje con IA
                </button>
            </div>

            {editingCharacter && <CharacterEditor character={editingCharacter} onUpdate={handleUpdateCharacter} onClose={() => setEditingCharacter(null)} allCharacters={characters} />}

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-700">
                <button onClick={onBack} className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-colors">Atrás</button>
                <button onClick={() => onComplete(characters)} className="w-full flex-grow bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-500 transition-colors">Continuar a Estructura</button>
            </div>
        </div>
    );
};

export default Phase3_Characters;