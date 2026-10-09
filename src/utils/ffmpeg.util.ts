import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

function runFFmpeg(args: string[]): void {
    console.log(`\nFFmpeg: ffmpeg ${args.join(" ")}`);

    const result = spawnSync("ffmpeg", args, {
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        console.error(result.stderr);

        throw new Error(
            `FFmpeg failed with exit code ${result.status}`,
        );
    }
}

function runFFprobe(args: string[]): string {
    const result = spawnSync("ffprobe", args, {
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        throw new Error(
            `FFprobe failed:\n${result.stderr}`,
        );
    }

    return result.stdout.trim();
}

export function getMediaDuration(
    mediaPath: string,
): number {
    if (!fs.existsSync(mediaPath)) {
        throw new Error(
            `Media file does not exist: ${mediaPath}`,
        );
    }

    const output = runFFprobe([
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        mediaPath,
    ]);

    const duration = parseFloat(output);

    if (!Number.isFinite(duration)) {
        throw new Error(
            `Unable to determine duration: ${mediaPath}`,
        );
    }

    return duration;
}

export function extractAudio(
    videoPath: string,
    audioPath: string,
): void {
    runFFmpeg([
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        audioPath,
    ]);
}

export function createVideoWithAudio(
    videoPath: string,
    audioPath: string,
    outputPath: string,
): void {
    const duration = getMediaDuration(videoPath);

    runFFmpeg([
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-af",
        "apad",
        "-t",
        duration.toFixed(3),
        "-shortest",
        outputPath,
    ]);
}

export function mergeVideos(
    videoPaths: string[],
    outputPath: string,
): void {
    if (videoPaths.length === 0) {
        throw new Error("No videos to merge.");
    }

    const outputDir = path.dirname(outputPath);

    fs.mkdirSync(outputDir, {
        recursive: true,
    });

    const concatFile = path.join(
        outputDir,
        "concat.txt",
    );

    const content = videoPaths
        .map((videoPath) => {
            const escaped = path
                .resolve(videoPath)
                .replace(/'/g, "'\\''");

            return `file '${escaped}'`;
        })
        .join("\n");

    fs.writeFileSync(
        concatFile,
        content,
        "utf-8",
    );

    runFFmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFile,
        "-c",
        "copy",
        outputPath,
    ]);

    fs.rmSync(concatFile, {
        force: true,
    });
}

export function normalizeAudio(
    inputPath: string,
    outputPath: string,
): void {
    runFFmpeg([
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "24000",
        "-c:a",
        "pcm_s16le",
        outputPath,
    ]);
}