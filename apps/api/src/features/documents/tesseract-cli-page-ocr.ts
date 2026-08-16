import { spawn } from "node:child_process";

import type { PageOcrEngine } from "./page-ocr.js";

const tesseractTimeoutMs = 60_000;

export class TesseractCliPageOcr implements PageOcrEngine {
  public readonly name = "tesseract";
  private language: string | null = null;

  public async recognize(imagePng: Uint8Array): Promise<string> {
    const language = await this.resolveLanguage();
    return runTesseract(imagePng, ["-", "stdout", "-l", language, "--psm", "6"]);
  }

  private async resolveLanguage(): Promise<string> {
    if (this.language !== null) {
      return this.language;
    }
    const languages = await listTesseractLanguages();
    if (languages.has("deu")) {
      this.language = "deu";
      return this.language;
    }
    if (languages.has("eng")) {
      this.language = "eng";
      return this.language;
    }
    throw new Error(
      "Tesseract is installed but has no usable language pack. Install deu (preferred) or eng."
    );
  }
}

async function listTesseractLanguages(): Promise<Set<string>> {
  const output = await runTesseract(null, ["--list-langs"]);
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[a-z]{3}(?:_[A-Z]{2})?$/.test(line))
  );
}

function runTesseract(
  imagePng: Uint8Array | null,
  args: readonly string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("tesseract", [...args], {
      stdio: [imagePng === null ? "ignore" : "pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Tesseract timed out while OCR-ing a PDF page."));
    }, tesseractTimeoutMs);

    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;
    if (stdoutStream === null || stderrStream === null) {
      reject(new Error("Tesseract stdio pipes could not be opened."));
      return;
    }
    stdoutStream.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
    });
    stderrStream.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        new Error(
          "Tesseract is required to OCR scanned PDFs. Install tesseract with the German language pack (deu).",
          { cause: error }
        )
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const details = Buffer.concat(stderr).toString("utf8").trim();
        reject(
          new Error(
            `Tesseract failed${code === null ? "" : ` (${String(code)})`}${
              details.length > 0 ? `: ${details}` : "."
            }`
          )
        );
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8").trim());
    });
    if (imagePng === null) {
      return;
    }
    const stdin = child.stdin;
    if (stdin === null) {
      reject(new Error("Tesseract stdin pipe could not be opened."));
      return;
    }
    stdin.on("error", (error) => {
      if (isErrnoException(error) && error.code === "EPIPE") {
        return;
      }
      clearTimeout(timeout);
      reject(error);
    });
    stdin.end(Buffer.from(imagePng));
  });
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
