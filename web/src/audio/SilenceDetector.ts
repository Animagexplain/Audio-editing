import { SilenceRegion, AudioClip } from '../types';

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
