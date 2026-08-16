export interface PageOcrEngine {
  readonly name: string;
  recognize(imagePng: Uint8Array): Promise<string>;
}
