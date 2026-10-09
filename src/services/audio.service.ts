import fs from "fs";

import { extractAudio } from "../utils/ffmpeg.util.js";

export function extractChunkAudio(chunkPath: string, outputPath: string): void {
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk does not exist: ${chunkPath}`);
  }

  extractAudio(chunkPath, outputPath);
}
