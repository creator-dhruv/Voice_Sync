import fs from "fs";
import path from "path";
import { SarvamAIClient } from "sarvamai";

import { env } from "../env.js";

const client = new SarvamAIClient({
  apiSubscriptionKey: env.SARVAM_API_KEY,
});

type TTSRequest = Parameters<typeof client.textToSpeech.convert>[0];
type STTRequest = Parameters<typeof client.speechToText.transcribe>[0];
type TranslateRequest = Parameters<typeof client.text.translate>[0];

function getTTSModel(): TTSRequest["model"] {
  return env.SARVAM_TTS_MODEL as TTSRequest["model"];
}

function getTTSSpeaker(): TTSRequest["speaker"] {
  return env.SARVAM_TTS_SPEAKER as TTSRequest["speaker"];
}

function getTTSLanguage(languageCode: string): TTSRequest["language_code"] {
  return languageCode as TTSRequest["language_code"];
}

function getSTTModel(): STTRequest["model"] {
  return env.SARVAM_STT_MODEL as STTRequest["model"];
}

function getSTTLanguage(languageCode: string): STTRequest["language_code"] {
  return (languageCode || env.SOURCE_LANGUAGE) as STTRequest["language_code"];
}

function getTranslateModel(): TranslateRequest["model"] {
  return env.SARVAM_TRANSLATE_MODEL as TranslateRequest["model"];
}

function getTranslateSourceLanguage(
  languageCode: string,
): TranslateRequest["source_language_code"] {
  return languageCode as TranslateRequest["source_language_code"];
}

function getTranslateTargetLanguage(
  languageCode: string,
): TranslateRequest["target_language_code"] {
  return languageCode as TranslateRequest["target_language_code"];
}

export async function batchSpeechToText(
  audioPath: string,
  sourceLanguage: string,
): Promise<{
  transcript: string;
  languageCode: string | null;
}> {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file does not exist: ${audioPath}`);
  }

  type BatchRequest = NonNullable<
    Parameters<typeof client.speechToTextJob.createJob>[0]
  >;

  const model = env.SARVAM_STT_MODEL as BatchRequest["model"];

  const job = await client.speechToTextJob.createJob({
    model,
    mode: "transcribe",
    languageCode: sourceLanguage as BatchRequest["languageCode"],
    withTimestamps: true,
  });

  await job.uploadFiles([audioPath]);

  await job.start();

  await job.waitUntilComplete();

  const results = await job.getFileResults();

  if (!results.successful?.length) {
    const failed = results.failed?.[0];

    throw new Error(failed?.error_message || "Sarvam Batch STT failed.");
  }

  const outputDirectory = path.join(path.dirname(audioPath), "stt-output");

  fs.mkdirSync(outputDirectory, {
    recursive: true,
  });

  await job.downloadOutputs(outputDirectory);

  const outputFiles = fs
    .readdirSync(outputDirectory)
    .filter((file) => file.endsWith(".json"));

  if (outputFiles.length === 0) {
    throw new Error(`No Batch STT output found in ${outputDirectory}`);
  }

  const outputPath = path.join(outputDirectory, outputFiles[0]);

  const result = JSON.parse(fs.readFileSync(outputPath, "utf-8"));

  return {
    transcript: result.transcript?.trim() || "",
    languageCode: result.language_code || null,
  };
}

export async function speechToText(
  audioPath: string,
  sourceLanguage: string,
): Promise<{
  transcript: string;
  languageCode: string | null;
}> {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file does not exist: ${audioPath}`);
  }

  const response = await client.speechToText.transcribe({
    file: fs.createReadStream(audioPath),
    model: getSTTModel(),
    mode: "transcribe",
    language_code: getSTTLanguage(sourceLanguage),
  });

  return {
    transcript: response.transcript?.trim() || "",
    languageCode: response.language_code || null,
  };
}

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> {
  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error("Cannot translate empty text.");
  }

  const response = await client.text.translate({
    input: cleanText,
    source_language_code: getTranslateSourceLanguage(sourceLanguage),
    target_language_code: getTranslateTargetLanguage(targetLanguage),
    model: getTranslateModel(),
    mode: "formal",
  });

  const translatedText = response.translated_text?.trim() || "";

  if (!translatedText) {
    throw new Error("Sarvam translation returned empty text.");
  }

  return translatedText;
}

export async function textToSpeech(
  text: string,
  languageCode: string,
  outputPath: string,
): Promise<void> {
  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error("Cannot generate TTS from empty text.");
  }

  const response = await client.textToSpeech.convert({
    text: cleanText,
    model: getTTSModel(),
    language_code: getTTSLanguage(languageCode),
    speaker: getTTSSpeaker(),
    pace: 1,
    speech_sample_rate: 24000,
  });

  if (!response.audios?.length) {
    throw new Error("Sarvam TTS returned no audio.");
  }

  const audioBuffer = Buffer.from(response.audios[0], "base64");

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true,
  });

  fs.writeFileSync(outputPath, audioBuffer);
}
