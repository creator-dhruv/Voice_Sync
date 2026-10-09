import { Router } from "express";
import type { Request, Response } from "express";

import { videoUpload } from "../utils/multer.util.js";
import { translateVideo } from "../services/video_translation.service.js";

const router = Router();

router.post(
  "/",
  videoUpload.single("video"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "A video file is required.",
        });
      }

      const sourceLanguage =
        typeof req.body.sourceLanguage === "string"
          ? req.body.sourceLanguage.trim()
          : "en-IN";

      const targetLanguage =
        typeof req.body.targetLanguage === "string"
          ? req.body.targetLanguage.trim()
          : "";

      if (!targetLanguage) {
        return res.status(400).json({
          status: "error",
          message: "targetLanguage is required.",
        });
      }

      if (sourceLanguage === targetLanguage) {
        return res.status(400).json({
          status: "error",
          message: "sourceLanguage and targetLanguage must be different.",
        });
      }

      const outputPath = await translateVideo(req.file.path, {
        sourceLanguage,
        targetLanguage,
      });

      return res.status(200).json({
        status: "success",
        message: "Video translated successfully.",
        data: {
          originalVideo: {
            filename: req.file.filename,
            path: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
          },
          translatedVideo: {
            path: outputPath,
          },
          sourceLanguage,
          targetLanguage,
        },
      });
    } catch (error: unknown) {
      console.error("Video translation failed:", error);

      return res.status(500).json({
        status: "error",
        message: "Video translation failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
