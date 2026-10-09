import fs from "fs";

import { mergeVideos } from "../utils/ffmpeg.util.js";

export function mergeTranslatedVideos(
  videoPaths: string[],
  outputPath: string,
): string {
  if (videoPaths.length === 0) {
    throw new Error("No translated videos available.");
  }

  for (const video of videoPaths) {
    if (!fs.existsSync(video)) {
      throw new Error(`Translated chunk missing: ${video}`);
    }
  }

  mergeVideos(videoPaths, outputPath);

  return outputPath;
}
