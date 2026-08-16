export interface DocumentStorage {
  delete(storageKey: string): Promise<void>;
  get(storageKey: string): Promise<Uint8Array>;
  put(storageKey: string, content: Uint8Array): Promise<void>;
}
