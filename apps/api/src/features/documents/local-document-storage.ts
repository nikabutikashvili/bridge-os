import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { DocumentStorage } from "./document-storage.js";

export class LocalDocumentStorage implements DocumentStorage {
  private readonly root: string;

  public constructor(root: string) {
    this.root = resolve(root);
  }

  public async put(storageKey: string, content: Uint8Array): Promise<void> {
    const target = this.resolveStorageKey(storageKey);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      try {
        await unlink(temporary);
      } catch (cleanupError) {
        if (!isMissingFileError(cleanupError)) {
          throw new AggregateError(
            [error, cleanupError],
            "Document write and temporary-file cleanup both failed."
          );
        }
      }
      throw error;
    }
  }

  public async get(storageKey: string): Promise<Uint8Array> {
    return readFile(this.resolveStorageKey(storageKey));
  }

  public async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  private resolveStorageKey(storageKey: string): string {
    if (!/^[a-zA-Z0-9._/-]+$/.test(storageKey)) {
      throw new Error("Storage key contains unsupported characters.");
    }
    const target = resolve(this.root, storageKey);
    const relativeTarget = relative(this.root, target);
    if (
      relativeTarget.length === 0 ||
      relativeTarget.startsWith("..") ||
      isAbsolute(relativeTarget)
    ) {
      throw new Error("Storage key resolves outside the configured root.");
    }
    return target;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
