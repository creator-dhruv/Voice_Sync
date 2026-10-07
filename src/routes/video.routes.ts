import { Router } from "express";
import type { Request, Response, } from "express";
import { videoUpload } from "../utils/multer.util.ts";

const router = Router();

router.post("/", videoUpload.single("video"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ status: "error", message: "A video file is required." });
    return;
  }

  res.status(201).json({
    status: "success",
    data: {
      filename: req.file.filename,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

export default router;