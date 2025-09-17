/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const DB_NAME = 'PixshopAssetDB';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

class AssetDBService {
    private dbPromise: Promise<IDBDatabase>;

    constructor() {
        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
        const db = await this.dbPromise;
        return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
    }

    public async saveAsset(id: string, blob: Blob): Promise<void> {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(blob, id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async loadAsset(id: string): Promise<Blob | null> {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async clearAllAssets(): Promise<void> {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const assetDBService = new AssetDBService();