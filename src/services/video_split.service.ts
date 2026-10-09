import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const SILENCE_DURATION = 0.4;

const LOWER_FREQ_LIMIT = 100;
const UPPER_FREQ_LIMIT = 4000;

// Keep safely below Sarvam's 30 second REST limit.
const MAX_CHUNK_DURATION = 29.0;

// Don't create extremely tiny chunks.
const MIN_CHUNK_DURATION = 8.0;

function detectVideoNoiseFloor(
    videoPath: string,
): number {
    if (!fs.existsSync(videoPath)) {
        return -25;
    }

    const ffmpeg = spawnSync(
        "ffmpeg",
        [
            "-i",
            videoPath,
            "-af",
            "volumedetect",
            "-f",
            "null",
            "-",
        ],
        {
            encoding: "utf-8",
        },
    );

    const stderr = ffmpeg.stderr || "";

    const meanVolumeMatch =
        stderr.match(
            /mean_volume:\s*(-?[\d.]+)\s+dB/,
        );

    if (
        meanVolumeMatch &&
        meanVolumeMatch[1]
    ) {
        const meanVolume =
            parseFloat(meanVolumeMatch[1]);

        const dynamicThreshold =
            Math.round(meanVolume - 6);

        return Math.min(
            Math.max(
                dynamicThreshold,
                -45,
            ),
            -15,
        );
    }

    return -25;
}

export function getSilenceTimestamps(
    videoPath: string,
): number[] {
    const threshold =
        detectVideoNoiseFloor(videoPath);

    const silenceThreshold =
        `${threshold}dB`;

    const voiceFilter =
        `highpass=f=${LOWER_FREQ_LIMIT},` +
        `lowpass=f=${UPPER_FREQ_LIMIT},` +
        `silencedetect=` +
        `noise=${silenceThreshold}:` +
        `duration=${SILENCE_DURATION}`;

    const ffmpeg = spawnSync(
        "ffmpeg",
        [
            "-i",
            videoPath,
            "-af",
            voiceFilter,
            "-f",
            "null",
            "-",
        ],
        {
            encoding: "utf-8",
        },
    );

    const stderr = ffmpeg.stderr || "";

    const regex =
        /silence_start:\s*([\d.]+)/g;

    const timestamps: number[] = [];

    let match: RegExpExecArray | null;

    while (
        (match = regex.exec(stderr)) !== null
    ) {
        const timestamp =
            parseFloat(match[1]);

        if (Number.isFinite(timestamp)) {
            timestamps.push(timestamp);
        }
    }

    return [
        ...new Set(timestamps),
    ].sort((a, b) => a - b);
}

function getVideoDuration(
    videoPath: string,
): number {
    const ffmpeg = spawnSync(
        "ffmpeg",
        [
            "-i",
            videoPath,
        ],
        {
            encoding: "utf-8",
        },
    );

    const stderr = ffmpeg.stderr || "";

    const match = stderr.match(
        /Duration:\s+(\d+):(\d+):([\d.]+)/,
    );

    if (!match) {
        return 0;
    }

    const hours =
        parseInt(match[1], 10);

    const minutes =
        parseInt(match[2], 10);

    const seconds =
        parseFloat(match[3]);

    return (
        hours * 3600 +
        minutes * 60 +
        seconds
    );
}

/**
 * Select a silence near the 29 second limit.
 *
 * Priority:
 *
 * 1. Silence between 20-29 sec
 * 2. Silence between 15-29 sec
 * 3. Any silence before 29 sec
 * 4. Hard cut at 29 sec
 *
 * A hard cut is unavoidable if someone continuously
 * speaks for >29 seconds.
 */
function optimizeSplitPoints(
    rawPoints: number[],
    totalDuration: number,
): number[] {
    const silencePoints =
        [...new Set(rawPoints)]
            .filter(
                (point) =>
                    point > 0 &&
                    point < totalDuration,
            )
            .sort((a, b) => a - b);

    const optimizedPoints: number[] = [];

    let chunkStart = 0;

    while (
        totalDuration - chunkStart >
        MAX_CHUNK_DURATION
    ) {
        const maxCut =
            chunkStart +
            MAX_CHUNK_DURATION;

        const minPreferredCut =
            chunkStart + 20;

        const preferredCandidates =
            silencePoints.filter(
                (point) =>
                    point >= minPreferredCut &&
                    point <= maxCut,
            );

        if (
            preferredCandidates.length > 0
        ) {
            const best =
                preferredCandidates.reduce(
                    (closest, current) =>
                        Math.abs(
                            current - maxCut,
                        ) <
                        Math.abs(
                            closest - maxCut,
                        )
                            ? current
                            : closest,
                );
            optimizedPoints.push(best);
            chunkStart = best;
            continue;
        }

        const fallbackCandidates =
            silencePoints.filter(
                (point) =>
                    point >
                        chunkStart +
                            MIN_CHUNK_DURATION &&
                    point <= maxCut,
            );

        if (
            fallbackCandidates.length > 0
        ) {
            const best =
                fallbackCandidates.reduce(
                    (closest, current) =>
                        Math.abs(
                            current - maxCut,
                        ) <
                        Math.abs(
                            closest - maxCut,
                        )
                            ? current
                            : closest,
                );
            optimizedPoints.push(best);
            chunkStart = best;
            continue;
        }

        /*
         * No silence before the Sarvam limit.
         *
         * We MUST cut here because Sarvam REST
         * accepts <= 30 seconds.
         *
         * This is the only case where speech can
         * potentially be cut.
         */
        const forcedCut =
            Math.min(
                maxCut,
                totalDuration,
            );

        optimizedPoints.push(
            forcedCut,
        );

        chunkStart = forcedCut;
    }

    return optimizedPoints;
}

export function splitVideoSmart(
    videoPath: string,
): string[] {
    const totalDuration =
        getVideoDuration(videoPath);

    if (totalDuration <= 0) {
        throw new Error(
            "Could not determine video duration.",
        );
    }

    const rawCuts =
        getSilenceTimestamps(videoPath);

    const smartCuts =
        optimizeSplitPoints(
            rawCuts,
            totalDuration,
        );

    console.log(
        "Detected silence points:",
        rawCuts,
    );

    console.log(
        "Selected split points:",
        smartCuts,
    );

    if (smartCuts.length === 0) {
        return [videoPath];
    }

    const parsedPath =
        path.parse(videoPath);

    const outputPattern =
        path.join(
            parsedPath.dir,
            `${parsedPath.name}_chunk_%03d${parsedPath.ext}`,
        );

    const segmentTimes =
        smartCuts.join(",");

    const ffmpeg = spawnSync(
        "ffmpeg",
        [
            "-y",
            "-i",
            videoPath,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-force_key_frames",
            segmentTimes,
            "-f",
            "segment",
            "-segment_times",
            segmentTimes,
            "-reset_timestamps",
            "1",
            outputPattern,
        ],
        {
            encoding: "utf-8",
        },
    );

    if (ffmpeg.status !== 0) {
        console.error(ffmpeg.stderr);

        throw new Error(
            "FFmpeg failed while splitting video.",
        );
    }

    return fs
        .readdirSync(parsedPath.dir)
        .filter(
            (file) =>
                file.startsWith(
                    `${parsedPath.name}_chunk_`,
                ) &&
                file.endsWith(
                    parsedPath.ext,
                ),
        )
        .sort()
        .map((file) =>
            path.join(
                parsedPath.dir,
                file,
            ),
        );
}