import "dotenv/config";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  SARVAM_API_KEY: getRequiredEnv("SARVAM_API_KEY"),

  SARVAM_STT_MODEL: process.env.SARVAM_STT_MODEL || "saaras:v4",

  SARVAM_TRANSLATE_MODEL:
    process.env.SARVAM_TRANSLATE_MODEL || "sarvam-translate:v1",

  SARVAM_TTS_MODEL: process.env.SARVAM_TTS_MODEL || "bulbul:v4-flash",

  SARVAM_TTS_SPEAKER: process.env.SARVAM_TTS_SPEAKER || "shubh_enhi_ads",

  SOURCE_LANGUAGE: process.env.SOURCE_LANGUAGE || "en-IN",

  VIDEO_TEMP_DIR: process.env.VIDEO_TEMP_DIR || "./temp/video-processing",
};
