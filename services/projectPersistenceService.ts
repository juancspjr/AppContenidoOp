/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { ExportedProject } from '@/components/story-builder/types';

const STORAGE_KEY = 'pixshop_saved_story_project';

class ProjectPersistenceService {
    public saveProject(project: ExportedProject): void {
        try {
            const jsonString = JSON.stringify(project);
            localStorage.setItem(STORAGE_KEY, jsonString);
        } catch (error) {
            console.error("Error guardando el proyecto en localStorage:", error);
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                throw new Error("No se pudo guardar la metadata del proyecto. El almacenamiento local está lleno. Intenta limpiar el caché de tu navegador.");
            }
            throw new Error("Ocurrió un error desconocido al guardar la metadata del proyecto.");
        }
    }

    public loadProject(): ExportedProject | null {
        const jsonString = localStorage.getItem(STORAGE_KEY);
        if (!jsonString) {
            return null;
        }
        try {
            const project = JSON.parse(jsonString) as ExportedProject;
            // Basic validation
            if (project && project.plan && project.assets) {
                return project;
            }
            return null;
        } catch (error) {
            console.error("Error cargando el proyecto desde localStorage:", error);
            this.clearSavedProject(); // Clear corrupted data
            return null;
        }
    }

    public hasSavedProject(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    public clearSavedProject(): void {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const projectPersistenceService = new ProjectPersistenceService();