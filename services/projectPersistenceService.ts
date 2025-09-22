/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { ExportedProject } from '../components/story-builder/types';
import { logger } from '../utils/logger';
import JSZip from 'jszip';
import { assetDBService } from './assetDBService';

const STORAGE_KEY = 'pixshop_saved_story_project_v2';

class ProjectPersistenceService {
    public saveProject(project: ExportedProject): void {
        try {
            // Create a clean, serializable version of the project state
            const savableProject = this.createSavableProject(project);
            const jsonString = JSON.stringify(savableProject);
            
            if (jsonString.length > 4.8 * 1024 * 1024) { // ~4.8MB warning threshold
                 logger.log('WARNING', 'PersistenceService', `Project size is large (${(jsonString.length / 1024).toFixed(2)} KB), nearing localStorage limit.`);
            }

            localStorage.setItem(STORAGE_KEY, jsonString);
            logger.log('DEBUG', 'PersistenceService', `Project saved. Size: ${(jsonString.length / 1024).toFixed(2)} KB`);
        } catch (error) {
            logger.log('ERROR', 'PersistenceService', "Error saving project to localStorage", error);
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                alert("Error de autoguardado: Almacenamiento local lleno. Por favor, exporta tu proyecto a un archivo .zip para guardar tu progreso.");
            } else {
                alert("Ocurrió un error desconocido al intentar autoguardar el proyecto.");
            }
        }
    }

    private createSavableProject(project: ExportedProject): ExportedProject {
        // Deep copy to avoid mutating the original state object
        const copy: ExportedProject = JSON.parse(JSON.stringify(project));

        // Sanitize characters: remove non-persistent data (File objects, temporary URLs)
        if (copy.characters) {
            copy.characters = copy.characters.map(char => {
                const { imageFile, imageUrl, ...savableChar } = char;
                return savableChar;
            });
        }
        
        return copy;
    }

    public loadProject(): ExportedProject | null {
        const jsonString = localStorage.getItem(STORAGE_KEY);
        if (!jsonString) {
            return null;
        }
        try {
            const project = JSON.parse(jsonString) as ExportedProject;
            // Migration for old format
            if(project.plan && !project.storyPlan) {
                project.storyPlan = project.plan;
                delete project.plan;
            }
            return project;
        } catch (error) {
            logger.log('ERROR', 'PersistenceService', "Error parsing project from localStorage", error);
            this.clearSavedProject();
            return null;
        }
    }

    public hasSavedProject(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    public clearSavedProject(): void {
        localStorage.removeItem(STORAGE_KEY);
        logger.log('INFO', 'PersistenceService', 'Saved project cleared from localStorage.');
    }

    public async exportProjectWithAssets(): Promise<void> {
        const project = this.loadProject();
        if (!project) {
            alert("No hay ningún proyecto guardado para exportar.");
            return;
        }
        
        logger.log('INFO', 'PersistenceService', 'Starting project export with assets...');
        const zip = new JSZip();

        // Add project metadata file, ensuring it's the clean, savable version
        const projectToExport = this.createSavableProject(project);
        zip.file('project.json', JSON.stringify(projectToExport, null, 2));

        const assetPromises: Promise<void>[] = [];
        
        // Add character reference images
        if (project.characters) {
            const charFolder = zip.folder('character_references');
            for (const char of project.characters) {
                if(char.imageAssetId) {
                    assetPromises.push(
                        assetDBService.loadAsset(char.imageAssetId).then(blob => {
                            if(blob) {
                                charFolder?.file(`${char.name.replace(/\s+/g, '_')}.png`, blob);
                            }
                        })
                    );
                }
            }
        }

        // Add generated reference assets
        const referenceAssets = project.referenceAssets;
        if (referenceAssets) {
            const refFolder = zip.folder('generated_reference_assets');
            const allRefs = [...referenceAssets.characters, ...referenceAssets.environments, ...referenceAssets.elements];
            for (const asset of allRefs) {
                assetPromises.push(
                    assetDBService.loadAsset(asset.assetId).then(blob => {
                        if (blob) {
                            refFolder?.file(`${asset.type}_${asset.name.replace(/\s+/g, '_')}.png`, blob);
                        }
                    })
                );
            }
        }

        // Add final video assets
        const finalAssets = project.finalAssets;
        if (finalAssets) {
            const finalFolder = zip.folder('final_videos');
            for (const asset of finalAssets.videoAssets) {
                 assetPromises.push(
                    assetDBService.loadAsset(asset.assetId).then(blob => {
                        if (blob) {
                            finalFolder?.file(`S${asset.sceneId.split('_')[1]}_P${asset.segment}.mp4`, blob);
                        }
                    })
                );
            }
        }
        
        await Promise.all(assetPromises);
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const title = project.storyPlan?.metadata.title.replace(/\s+/g, '_') || 'story_project';
        a.download = `${title}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logger.log('SUCCESS', 'PersistenceService', 'Project exported successfully.');
    }
}

export const projectPersistenceService = new ProjectPersistenceService();