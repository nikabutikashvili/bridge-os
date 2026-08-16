import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { FixturePdf } from "./fixture-ingestion-service.js";

export async function loadFixturePdfs(directory: string): Promise<FixturePdf[]> {
  const absoluteDirectory = resolve(directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "de-DE"));

  return Promise.all(
    filenames.map(async (filename) => ({
      content: await readFile(resolve(absoluteDirectory, filename)),
      filename
    }))
  );
}
