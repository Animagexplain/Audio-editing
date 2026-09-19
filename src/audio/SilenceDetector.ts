import { SilenceRegion, AudioClip, Track } from '../types';

/**
 * Detects silent intervals in an AudioBuffer based on threshold in dB and minDuration.
 */
export function detectSilence(
  buffer: AudioBuffer,
  thresholdDb: number = -40,
  minDurationSec: number = 0.3,
  startSec: number = 0,
  endSec?: number
): SilenceRegion[] {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const duration = buffer.duration;

  const actualStart = Math.max(0, startSec);
  const actualEnd = Math.min(duration, endSec ?? duration);
  const startSample = Math.floor(actualStart * sampleRate);
  const endSample = Math.floor(actualEnd * sampleRate);

  if (endSample <= startSample) return [];

  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const minSamples = Math.floor(minDurationSec * sampleRate);

  // Analyze in chunks of ~15ms
  const blockSize = Math.floor(sampleRate * 0.015);
  const totalBlocks = Math.floor((endSample - startSample) / blockSize);

  const channelsData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelsData.push(buffer.getChannelData(c));
  }

  const silentRegions: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStartSample = 0;

  for (let b = 0; b < totalBlocks; b++) {
    const blockStart = startSample + b * blockSize;
    const blockEnd = Math.min(blockStart + blockSize, endSample);

    // Compute peak of block
    let blockPeak = 0;
    for (let c = 0; c < numChannels; c++) {
      const ch = channelsData[c];
      for (let s = blockStart; s < blockEnd; s += 2) {
        const abs = Math.abs(ch[s]);
        if (abs > blockPeak) blockPeak = abs;
      }
    }

    const isSilentBlock = blockPeak < thresholdLinear;

    if (isSilentBlock) {
      if (!inSilence) {
        inSilence = true;
        silenceStartSample = blockStart;
      }
    } else {
      if (inSilence) {
        const silenceLength = blockStart - silenceStartSample;
        if (silenceLength >= minSamples) {
          silentRegions.push({
            start: silenceStartSample / sampleRate,
            end: blockStart / sampleRate,
          });
        }
        inSilence = false;
      }
    }
  }

  // Handle trailing silence
  if (inSilence) {
    const silenceLength = endSample - silenceStartSample;
    if (silenceLength >= minSamples) {
      silentRegions.push({
        start: silenceStartSample / sampleRate,
        end: endSample / sampleRate,
      });
    }
  }

  return silentRegions;
}

/**
 * Removes detected silences from an audio clip non-destructively by splitting
 * the clip into active audible segments and placing them consecutively.
 */
export function removeSilencesFromClip(
  clip: AudioClip,
  silences: SilenceRegion[]
): AudioClip[] {
  if (silences.length === 0) return [clip];

  const clipStartInOriginal = clip.offsetInOriginal;
  const clipEndInOriginal = clip.offsetInOriginal + clip.duration;

  // Filter silences that intersect with this clip
  const clipSilences = silences
    .filter(s => s.end > clipStartInOriginal && s.start < clipEndInOriginal)
    .map(s => ({
      start: Math.max(clipStartInOriginal, s.start),
      end: Math.min(clipEndInOriginal, s.end),
    }))
    .sort((a, b) => a.start - b.start);

  if (clipSilences.length === 0) return [clip];

  const newClips: AudioClip[] = [];
  let currentPosInOriginal = clipStartInOriginal;
  let currentTimelineTime = clip.startTime;

  for (let i = 0; i < clipSilences.length; i++) {
    const silence = clipSilences[i];
    if (silence.start > currentPosInOriginal) {
      // Audible segment before this silence
      const segDuration = silence.start - currentPosInOriginal;
      newClips.push({
        ...clip,
        id: `${clip.id}_seg_${i}`,
        startTime: currentTimelineTime,
        offsetInOriginal: currentPosInOriginal,
        duration: segDuration,
      });
      currentTimelineTime += segDuration;
    }
    // Skip silence
    currentPosInOriginal = silence.end;
  }

  // Final segment after last silence
  if (currentPosInOriginal < clipEndInOriginal) {
    const segDuration = clipEndInOriginal - currentPosInOriginal;
    newClips.push({
      ...clip,
      id: `${clip.id}_seg_end`,
      startTime: currentTimelineTime,
      offsetInOriginal: currentPosInOriginal,
      duration: segDuration,
    });
  }

  return newClips;
}

/**
 * Automatically calculates the optimal threshold for inaudible sounds/silences
 * (inaudible room noise, pauses between words) and detects all silent regions.
 * Uses -40dB as the standard vocal threshold and 0.25s as the minimum pause duration.
 */
export function autoDetectInaudibleSilence(
  buffer: AudioBuffer,
  startSec: number = 0,
  endSec?: number
): { silences: SilenceRegion[]; thresholdDb: number } {
  const thresholdDb = -40;
  const minDurationSec = 0.25;
  const silences = detectSilence(buffer, thresholdDb, minDurationSec, startSec, endSec);
  return { silences, thresholdDb };
}

export interface AutoSilenceResult {
  updatedTrack: Track;
  totalSilencesRemoved: number;
  totalDurationSaved: number;
}

/**
 * 1-Click Auto Silence Remover:
 * Automatically strips out inaudible silences and empty pauses from audio clips,
 * seamlessly joining active voice parts together without requiring manual adjustments.
 */
export function autoRemoveSilenceFromTrack(
  track: Track,
  getBuffer: (bufferId: string) => AudioBuffer | undefined,
  targetClipId?: string
): AutoSilenceResult {
  let totalSilencesRemoved = 0;
  let totalDurationSaved = 0;
  const newClips: AudioClip[] = [];

  let runningStartTime = 0;

  for (let cIdx = 0; cIdx < track.clips.length; cIdx++) {
    const clip = track.clips[cIdx];
    // If a specific clip is targeted, only process that clip
    if (targetClipId && clip.id !== targetClipId) {
      newClips.push({
        ...clip,
        startTime: runningStartTime,
      });
      runningStartTime += clip.duration;
      continue;
    }

    const buffer = getBuffer(clip.bufferId);
    if (!buffer) {
      newClips.push({
        ...clip,
        startTime: runningStartTime,
      });
      runningStartTime += clip.duration;
      continue;
    }

    const { silences } = autoDetectInaudibleSilence(
      buffer,
      clip.offsetInOriginal,
      clip.offsetInOriginal + clip.duration
    );

    if (silences.length === 0) {
      newClips.push({
        ...clip,
        startTime: runningStartTime,
      });
      runningStartTime += clip.duration;
      continue;
    }

    const origDuration = clip.duration;
    const splitClips = removeSilencesFromClip(clip, silences);

    const newDuration = splitClips.reduce((sum, c) => sum + c.duration, 0);
    totalSilencesRemoved += silences.length;
    totalDurationSaved += Math.max(0, origDuration - newDuration);

    for (const sc of splitClips) {
      newClips.push({
        ...sc,
        startTime: runningStartTime,
      });
      runningStartTime += sc.duration;
    }
  }

  return {
    updatedTrack: {
      ...track,
      clips: newClips,
    },
    totalSilencesRemoved,
    totalDurationSaved,
  };
}
