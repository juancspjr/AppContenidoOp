/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { ReferenceAsset } from '@/components/story-builder/types';
import { imageBlobCache } from './imageBlobCache';

export type AssetType = 'character' | 'environment' | 'element' | 'scene_frame';

export interface CanonicalAsset {
    id: string;
    name: string;
    type: AssetType;
    tags: string[];
    aspectRatio: '9:16' | '1:1' | '16:9' | '4:5';
    prompt: string;
    blobId: string; // id en imageBlobCache
    sourcePhase: 'phase3' | 'phase6.3' | 'scene';
    originHash?: string; // hash de imagen de FASE 3 si aplica
}

class AssetRegistry {
    private static LS_KEY = 'asset_registry_v2';
    private assets: CanonicalAsset[] = [];

    constructor() { this.load(); }

    add(asset: CanonicalAsset) {
        const exists = this.assets.find(a => a.type === asset.type && a.name.toLowerCase() === asset.name.toLowerCase());
        if (!exists) { 
            this.assets.push(asset); 
            this.save(); 
        }
    }

    upsert(asset: CanonicalAsset) {
        const idx = this.assets.findIndex(a => a.type === asset.type && a.name.toLowerCase() === asset.name.toLowerCase());
        if (idx >= 0) this.assets[idx] = asset; 
        else this.assets.push(asset);
        this.save();
    }

    findByName(name: string, type?: AssetType): CanonicalAsset | undefined {
        const n = name.trim().toLowerCase();
        return this.assets.find(a => a.name.toLowerCase() === n && (!type || a.type === type));
    }
    
    findById(id: string): CanonicalAsset | undefined {
        return this.assets.find(a => a.id === id);
    }

    list(type?: AssetType): CanonicalAsset[] { 
        return type ? this.assets.filter(a => a.type === type) : this.assets; 
    }
    
    clear() {
        this.assets = [];
        localStorage.removeItem(AssetRegistry.LS_KEY);
    }

    private load() { 
        try { 
            this.assets = JSON.parse(localStorage.getItem(AssetRegistry.LS_KEY) || '[]'); 
        } catch { 
            this.assets = []; 
        } 
    }
    private save() { 
        localStorage.setItem(AssetRegistry.LS_KEY, JSON.stringify(this.assets, null, 2)); 
    }
}

export const assetRegistry = new AssetRegistry();
