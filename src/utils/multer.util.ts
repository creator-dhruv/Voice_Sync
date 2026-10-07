import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import multer from "multer";

const videoDirectory = path.resolve(process.cwd(), "uploads", "videos");

const storage = multer.diskStorage({
	destination: (_req, _file, callback) => {
		mkdir(videoDirectory, { recursive: true })
			.then(() => callback(null, videoDirectory))
			.catch((error: Error) => callback(error, videoDirectory));
	},
	filename: (_req, file, callback) => {
		callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
	},
});

export const videoUpload = multer({
	storage,
	limits: { fileSize: 500 * 1024 * 1024 },
	fileFilter: (_req, file, callback) => {
		if (!file.mimetype.startsWith("video/")) {
			const error = Object.assign(new Error("Only video files are allowed."), { status: 400 });
			callback(error);
			return;
		}

		callback(null, true);
	},
});