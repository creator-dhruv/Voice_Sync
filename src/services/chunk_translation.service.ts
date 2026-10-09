import fs from "fs";
import path from "path";

import { extractChunkAudio } from "./audio.service.js";
import {
  translateText,
  textToSpeech,
  batchSpeechToText,
} from "./sarvam.service.js";
import {
  createVideoWithAudio,
  getMediaDuration,
} from "../utils/ffmpeg.util.js";

export interface ProcessChunkOptions {
  sourceLanguage: string;
  targetLanguage: string;
  workDirectory: string;
}

export interface ProcessedChunk {
  inputVideo: string;
  audioPath: string;
  transcript: string;
  translatedText: string;
  translatedAudio: string;
  outputVideo: string;
}

export async function processChunk(
  chunkPath: string,
  options: ProcessChunkOptions,
): Promise<ProcessedChunk> {
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk does not exist: ${chunkPath}`);
  }

  const chunkName = path.parse(chunkPath).name;

  const chunkDirectory = path.join(options.workDirectory, chunkName);

  fs.mkdirSync(chunkDirectory, {
    recursive: true,
  });

  const audioPath = path.join(chunkDirectory, `${chunkName}.wav`);

  console.log(`\n[${chunkName}] Extracting audio...`);

  extractChunkAudio(chunkPath, audioPath);

  console.log(`[${chunkName}] Running Sarvam Batch STT...`);

  const stt = await batchSpeechToText(audioPath, options.sourceLanguage);

  const transcript = stt.transcript.trim();

  console.log(`[${chunkName}] Transcript:`, transcript);

  if (!transcript) {
    console.log(`[${chunkName}] No speech detected.`);

    return {
      inputVideo: chunkPath,
      audioPath,
      transcript: "",
      translatedText: "",
      translatedAudio: audioPath,
      outputVideo: chunkPath,
    };
  }

  console.log(`[${chunkName}] Translating...`);

  const translatedText = await translateText(
    transcript,
    stt.languageCode || options.sourceLanguage,
    options.targetLanguage,
  );

  console.log(`[${chunkName}] Translation:`, translatedText);

  const translatedAudio = path.join(
    chunkDirectory,
    `${chunkName}_translated.wav`,
  );

  console.log(`[${chunkName}] Generating TTS...`);

  await textToSpeech(translatedText, options.targetLanguage, translatedAudio);

  if (!fs.existsSync(translatedAudio)) {
    throw new Error(`Translated audio was not created: ${translatedAudio}`);
  }

  const outputVideo = path.join(chunkDirectory, `${chunkName}_translated.mp4`);

  console.log(`[${chunkName}] Creating translated video...`);

  createVideoWithAudio(chunkPath, translatedAudio, outputVideo);

  if (!fs.existsSync(outputVideo)) {
    throw new Error(`Translated video was not created: ${outputVideo}`);
  }

  const duration = getMediaDuration(outputVideo);

  console.log(`[${chunkName}] Completed. Duration: ${duration.toFixed(2)}s`);

  return {
    inputVideo: chunkPath,
    audioPath,
    transcript,
    translatedText,
    translatedAudio,
    outputVideo,
  };
}
