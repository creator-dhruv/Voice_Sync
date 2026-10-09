import fs from "fs";
import path from "path";
import { splitVideoSmart } from "./video_split.service.js";
import { processChunk } from "./chunk_translation.service.js";
import { mergeTranslatedVideos } from "./video_merge.service.js";
import { env } from "../env.js";

export interface TranslateVideoOptions {
  sourceLanguage?: string;
  targetLanguage: string;
}

export async function translateVideo(
  videoPath: string,
  options: TranslateVideoOptions,
): Promise<string> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Input video does not exist: ${videoPath}`);
  }

  const sourceLanguage = options.sourceLanguage || env.SOURCE_LANGUAGE;

  const targetLanguage = options.targetLanguage;

  /*
   * Unique processing directory
   */

  const videoName = path.parse(videoPath).name;

  const workDirectory = path.resolve(env.VIDEO_TEMP_DIR, videoName);

  fs.mkdirSync(workDirectory, {
    recursive: true,
  });

  console.log("\n======================================");

  console.log("VIDEO TRANSLATION STARTED");

  console.log("======================================");

  console.log("Input:", videoPath);

  console.log("Source:", sourceLanguage);

  console.log("Target:", targetLanguage);

  /*
   * STEP 1
   *
   * Split video at pauses.
   */

  console.log("\nSTEP 1: Splitting video...");

  const chunks = splitVideoSmart(videoPath);

  console.log(`Created ${chunks.length} chunks.`);

  /*
   * STEP 2
   *
   * Process each chunk.
   */

  const translatedVideos: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    console.log(`\n======================================`);

    console.log(`PROCESSING CHUNK ${i + 1}/${chunks.length}`);

    console.log(`======================================`);

    try {
      const result = await processChunk(chunk, {
        sourceLanguage,
        targetLanguage,
        workDirectory,
      });

      translatedVideos.push(result.outputVideo);

      console.log(`Chunk ${i + 1} completed.`);
    } catch (error) {
      console.error(`Chunk ${i + 1} failed:`, error);

      throw new Error(`Failed processing chunk ${i + 1}: ${chunk}`);
    }
  }

  /*
   * STEP 3
   *
   * Merge translated chunks.
   */

  console.log("\nSTEP 3: Merging translated chunks...");

  const outputPath = path.join(
    path.dirname(videoPath),
    `${videoName}_${targetLanguage}_translated.mp4`,
  );

  mergeTranslatedVideos(translatedVideos, outputPath);

  console.log("\n======================================");

  console.log("VIDEO TRANSLATION COMPLETE");

  console.log("======================================");

  console.log("Output:", outputPath);

  return outputPath;
}
