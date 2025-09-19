/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { ExportedProject } from '../components/story-builder/types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'pixshop_saved_story_project_v2';

class ProjectPersistenceService {
    public saveProject(project: ExportedProject): void {
        try {
            const jsonString = JSON.stringify(project);
            localStorage.setItem(STORAGE_KEY, jsonString);
            logger.log('DEBUG', 'PersistenceService', `Project saved. Size: ${(jsonString.length / 1024).toFixed(2)} KB`);
        } catch (error) {
            logger.log('ERROR', 'PersistenceService', "Error saving project to localStorage", error);
            if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                throw new Error("Could not save project metadata. Local storage is full. Try clearing your browser cache.");
            }
            throw new Error("An unknown error occurred while saving project metadata.");
        }
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
}

export const projectPersistenceService = new ProjectPersistenceService();
