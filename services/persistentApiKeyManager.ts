/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { API_KEYS } from '../config/secure_config';
import { logger } from '../utils/logger';

export interface APIKeyData {
  id: string;
  projectName: string;
  api_key: string;
}

export interface APIKeyStatus {
  keyId: string;
  status: 'available' | 'exhausted';
  cooldownUntil?: number; // Timestamp
  lastUsed?: number;
  lastError?: string;
}

const STORAGE_KEY = 'api_key_status_v2';
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

class PersistentAPIKeyManagerService {
  private keys: APIKeyData[];
  private keyStatus: Record<string, APIKeyStatus> = {};
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.keys = API_KEYS.map((key, index) => ({
      id: `key_${index}`,
      ...key,
    }));
    this.loadStatus();
    this.validateKeys();
  }

  private validateKeys() {
    if (this.keys.length === 0 || this.keys.every(k => k.api_key.startsWith('YOUR_API_KEY_HERE'))) {
        logger.log('WARNING', 'APIKeyManager', 'No valid API keys found in config/secure_config.ts. Please add your keys to enable API functionality.');
    }
  }

  private loadStatus() {
    try {
      const storedStatus = localStorage.getItem(STORAGE_KEY);
      if (storedStatus) {
        this.keyStatus = JSON.parse(storedStatus);
      } else {
        this.resetAllKeyStatus();
      }
    } catch (e) {
      logger.log('ERROR', 'APIKeyManager', 'Failed to load key status from localStorage.', e);
      this.resetAllKeyStatus();
    }
  }
  
  private saveStatus() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.keyStatus));
    this.notifySubscribers();
  }
  
  private notifySubscribers() {
    this.subscribers.forEach(cb => cb());
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  public resetAllKeyStatus() {
      this.keys.forEach(key => {
        this.keyStatus[key.id] = {
            keyId: key.id,
            status: 'available',
        };
      });
      this.saveStatus();
      logger.log('INFO', 'APIKeyManager', 'All API key statuses have been reset.');
  }

  public getAvailableKeys(): APIKeyData[] {
    const now = Date.now();
    return this.keys.filter(key => {
      const status = this.keyStatus[key.id];
      if (!status) {
        this.keyStatus[key.id] = { keyId: key.id, status: 'available' };
        this.saveStatus();
        return true;
      }
      if (status.status === 'exhausted' && status.cooldownUntil && now > status.cooldownUntil) {
        // Cooldown has passed, make it available again
        status.status = 'available';
        status.cooldownUntil = undefined;
        status.lastError = undefined;
        this.saveStatus();
        return true;
      }
      return status.status === 'available';
    });
  }

  public markAsSuccessful(keyId: string) {
    if (this.keyStatus[keyId]) {
      this.keyStatus[keyId].lastUsed = Date.now();
      this.saveStatus();
    }
  }

  public markAsExhausted(keyId: string, errorMessage: string) {
    if (this.keyStatus[keyId]) {
      this.keyStatus[keyId].status = 'exhausted';
      this.keyStatus[keyId].cooldownUntil = Date.now() + COOLDOWN_PERIOD_MS;
      this.keyStatus[keyId].lastError = errorMessage;
      this.saveStatus();
      logger.log('WARNING', 'APIKeyManager', `Key ID ${keyId} marked as exhausted. Cooldown until ${new Date(this.keyStatus[keyId].cooldownUntil!).toISOString()}`);
    }
  }
  
  public getAllKeyStatuses(): (APIKeyData & APIKeyStatus)[] {
    return this.keys.map(key => {
        const status = this.keyStatus[key.id] || { keyId: key.id, status: 'available' };
        return { ...key, ...status };
    });
  }
}

export const PersistentAPIKeyManager = new PersistentAPIKeyManagerService();
