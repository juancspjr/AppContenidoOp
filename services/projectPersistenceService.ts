/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { ExportedProject } from '../components/story-builder/types';
import { assetDBService } from './assetDBService';
import { logger } from '../utils/logger';

// Since we can't add a new library like JSZip, we'll download files individually.
// A more advanced implementation would use a library to create a single zip file.

class ProjectPersistenceService {
    private readonly projectKey = 'storyBuilderProject';

    public saveProject(project: ExportedProject): void {
        try {
            const projectString = JSON.stringify(project);
            localStorage.setItem(this.projectKey, projectString);
            logger.log('SUCCESS', 'PersistenceService', 'Project saved to local session.');
        } catch (error) {
            logger.log('ERROR', 'PersistenceService', 'Failed to save project to localStorage.', error);
        }
    }

    public loadProject(): ExportedProject | null {
        try {
            const projectString = localStorage.getItem(this.projectKey);
            if (projectString) {
                const project = JSON.parse(projectString) as ExportedProject;
                logger.log('SUCCESS', 'PersistenceService', 'Project loaded from local session.');
                return project;
            }
            return null;
        } catch (error) {
            logger.log('ERROR', 'PersistenceService', 'Failed to load project from localStorage.', error);
            this.clearSavedProject(); // Clear corrupted data
            return null;
        }
    }
    
    public hasSavedProject(): boolean {
        return localStorage.getItem(this.projectKey) !== null;
    }
    
    public clearSavedProject(): void {
        localStorage.removeItem(this.projectKey);
        logger.log('INFO', 'PersistenceService', 'Cleared saved project from local session.');
    }
    
    private downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    public async exportProjectWithAssets(): Promise<void> {
        logger.log('INFO', 'PersistenceService', 'Starting project export...');
        const project = this.loadProject();
        if (!project) {
            alert("No project found to export.");
            logger.log('WARNING', 'PersistenceService', 'Export cancelled: no project found.');
            return;
        }

        try {
            // 1. Export the main project JSON file
            const projectJson = JSON.stringify(project, null, 2);
            const projectBlob = new Blob([projectJson], { type: 'application/json' });
            this.downloadBlob(projectBlob, 'project.json');
            
            // 2. Collect all asset IDs from the project
            const assetIds = new Set<string>();
            // FIX: Correctly access properties on the `ExportedProject` type.
            project.characters?.forEach(c => {
                if (c.imageAssetId) assetIds.add(c.imageAssetId);
            });
            project.referenceAssets?.characters?.forEach(a => assetIds.add(a.assetId));
            project.referenceAssets?.environments?.forEach(a => assetIds.add(a.assetId));
            project.referenceAssets?.elements?.forEach(a => assetIds.add(a.assetId));
            project.storyboardAssets?.forEach(a => assetIds.add(a.assetId));
            project.finalAssets?.assets?.forEach(a => assetIds.add(a.assetId));
            
            if (assetIds.size > 0) {
                alert(`El proyecto se descargará como un archivo 'project.json'. A continuación, se descargarán ${assetIds.size} archivos de activos multimedia. Por favor, permite las descargas múltiples en tu navegador.`);
                
                // 3. Download each asset from IndexedDB
                for (const assetId of assetIds) {
                    const blob = await assetDBService.loadAsset(assetId);
                    if (blob) {
                        const extension = blob.type.split('/')[1] || 'bin';
                        this.downloadBlob(blob, `${assetId}.${extension}`);
                        // Add a small delay to help browsers manage multiple downloads
                        await new Promise(resolve => setTimeout(resolve, 300));
                    } else {
                         logger.log('WARNING', 'PersistenceService', `Asset ID ${assetId} not found in DB for export.`);
                    }
                }
            }
            
            logger.log('SUCCESS', 'PersistenceService', 'Project and assets exported successfully.');
            
        } catch(error) {
            logger.log('ERROR', 'PersistenceService', 'An error occurred during project export.', error);
            alert("An error occurred during export. Check the console for details.");
        }
    }
}

export const projectPersistenceService = new ProjectPersistenceService();