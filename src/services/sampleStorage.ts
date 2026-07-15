/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StoredSample {
  name: string;
  type: string;
  data: Blob;
  rootMidi: number;
}

export class SampleStorage {
  private static DB_NAME = 'studio-sample-db';
  private static STORE_NAME = 'instrument-samples';
  private static DB_VERSION = 1;

  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('SampleStorage: database open blocked by another connection.');
      };
    });

    return this.dbPromise;
  }

  private static isQuotaExceeded(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'QuotaExceededError';
  }

  public static async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (!navigator.storage?.estimate) return null;
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch {
      return null;
    }
  }

  public static async saveSample(
    instrument: string,
    name: string,
    type: string,
    blob: Blob,
    rootMidi: number
  ): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      const data: StoredSample = { name, type, data: blob, rootMidi };

      let requestError: DOMException | null = null;
      const request = store.put(data, instrument);

      request.onerror = () => {
        requestError = request.error;
      };

      transaction.oncomplete = () => resolve();

      transaction.onerror = () => {
        const error = requestError || transaction.error;
        if (this.isQuotaExceeded(error)) {
          reject(new Error('Not enough browser storage space to save this sample. Try removing unused samples first.'));
        } else {
          reject(error);
        }
      };

      transaction.onabort = () => {
        const error = requestError || transaction.error;
        reject(error || new Error('Sample save was aborted.'));
      };
    });
  }

  /**
   * Retrieves a sample. Returns null only when the instrument genuinely has
   * no stored sample. A closed/broken connection or other storage failure
   * throws instead of returning null, so callers can tell "no sample" apart
   * from "storage is broken" rather than silently treating both the same.
   */
  public static async getSample(instrument: string): Promise<StoredSample | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(this.STORE_NAME, 'readonly');
      } catch (err) {
        // getDB()'s cached connection can go stale (e.g. closed by an
        // onversionchange from another tab). Reset the cache so the next
        // call reopens a fresh connection, and surface the real error.
        this.dbPromise = null;
        reject(err);
        return;
      }
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(instrument);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Retrieves all samples. See getSample() for the error-handling rationale:
   * failures are surfaced rather than silently collapsed to an empty result.
   */
  public static async getAllSamples(): Promise<Record<string, StoredSample>> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(this.STORE_NAME, 'readonly');
      } catch (err) {
        this.dbPromise = null;
        reject(err);
        return;
      }
      const store = transaction.objectStore(this.STORE_NAME);

      const result: Record<string, StoredSample> = {};
      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          result[String(cursor.key)] = cursor.value as StoredSample;
          cursor.continue();
        } else {
          resolve(result);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public static async deleteSample(instrument: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(instrument);

      transaction.oncomplete = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public static async clearAllSamples(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      transaction.oncomplete = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}