/**
 * Audio Normalization Module
 * Supports:
 * 1. Peak Normalization (target dBFS)
 * 2. Loudness Normalization (ITU-R BS.1770 / EBU R128 integrated LUFS, default -14 LUFS)
 */

export interface NormalizationResult {
  currentPeakDb: number;
  currentLufs?: number;
  gainFactor: number;
  gainDb: number;
}

/**
 * Calculates Peak level in dBFS and the required gain factor.
 */
export function calculatePeakNormalization(
  buffer: AudioBuffer,
  targetDb: number = 0,
  startSec: number = 0,
  endSec?: number
): NormalizationResult {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor((endSec ?? buffer.duration) * sampleRate));
  const numChannels = buffer.numberOfChannels;

  let peak = 0.00001;

  for (let c = 0; c < numChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = startSample; i < endSample; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  const currentPeakDb = 20 * Math.log10(peak);
  const targetLinear = Math.pow(10, targetDb / 20);
  const gainFactor = targetLinear / peak;
  const gainDb = 20 * Math.log10(gainFactor);

  return {
    currentPeakDb,
    gainFactor,
    gainDb,
  };
}

/**
 * K-weighting pre-filter coefficients for ITU-R BS.1770 at 44.1kHz / 48kHz
 */
function applyKWeighting(data: Float32Array, sampleRate: number): Float32Array {
  const length = data.length;
  const out = new Float32Array(length);

  // High-shelf stage (Stage 1)
  // Approximated for standard sample rates
  const dbGain = 3.9998438;
  const v = Math.pow(10, dbGain / 20);
  const k = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
  const vh = Math.pow(10, dbGain / 40);
  const a0 = 1 + Math.SQRT2 * k + k * k;
  const b0 = (vh + Math.SQRT2 * Math.sqrt(vh) * k + k * k) / a0;
  const b1 = (2 * (k * k - vh)) / a0;
  const b2 = (vh - Math.SQRT2 * Math.sqrt(vh) * k + k * k) / a0;
  const a1 = (2 * (k * k - 1)) / a0;
  const a2 = (1 - Math.SQRT2 * k + k * k) / a0;

  // High-pass RLB stage (Stage 2)
  const fc = 38.13547087602444;
  const kRlb = Math.tan((Math.PI * fc) / sampleRate);
  const a0Rlb = 1 + Math.SQRT2 * kRlb + kRlb * kRlb;
  const b0Rlb = 1 / a0Rlb;
  const b1Rlb = -2 / a0Rlb;
  const b2Rlb = 1 / a0Rlb;
  const a1Rlb = (2 * (kRlb * kRlb - 1)) / a0Rlb;
  const a2Rlb = (1 - Math.SQRT2 * kRlb + kRlb * kRlb) / a0Rlb;

  // Direct Form II Biquad Filter execution
  let x1_1 = 0, x2_1 = 0, y1_1 = 0, y2_1 = 0;
  let x1_2 = 0, x2_2 = 0, y1_2 = 0, y2_2 = 0;

  for (let i = 0; i < length; i++) {
    const x = data[i];
    // Stage 1
    const yStage1 = b0 * x + b1 * x1_1 + b2 * x2_1 - a1 * y1_1 - a2 * y2_1;
    x2_1 = x1_1;
    x1_1 = x;
    y2_1 = y1_1;
    y1_1 = yStage1;

    // Stage 2
    const yStage2 = b0Rlb * yStage1 + b1Rlb * x1_2 + b2Rlb * x2_2 - a1Rlb * y1_2 - a2Rlb * y2_2;
    x2_2 = x1_2;
    x1_2 = yStage1;
    y2_2 = y1_2;
    y1_2 = yStage2;

    out[i] = yStage2;
  }

  return out;
}

/**
 * Calculates integrated LUFS according to ITU-R BS.1770-4
 */
export function calculateLoudnessLUFS(
  buffer: AudioBuffer,
  startSec: number = 0,
  endSec?: number
): number {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor((endSec ?? buffer.duration) * sampleRate));
  const numChannels = buffer.numberOfChannels;
  const numSamples = endSample - startSample;

  if (numSamples <= 0) return -70;

  let totalMeanSquare = 0;

  for (let c = 0; c < numChannels; c++) {
    const channelData = buffer.getChannelData(c).subarray(startSample, endSample);
    const weighted = applyKWeighting(channelData, sampleRate);

    let sumSquares = 0;
    for (let i = 0; i < weighted.length; i++) {
      sumSquares += weighted[i] * weighted[i];
    }
    const meanSquare = sumSquares / numSamples;
    const channelWeight = c < 2 ? 1.0 : 1.41; // Surround weighting if >2 channels
    totalMeanSquare += channelWeight * meanSquare;
  }

  if (totalMeanSquare <= 0) return -70;

  const lufs = -0.691 + 10 * Math.log10(totalMeanSquare);
  return Math.max(-70, Math.min(10, lufs));
}

/**
 * Calculates Loudness (LUFS) normalization gain factor.
 */
export function calculateLoudnessNormalization(
  buffer: AudioBuffer,
  targetLufs: number = -14,
  startSec: number = 0,
  endSec?: number
): NormalizationResult {
  const currentLufs = calculateLoudnessLUFS(buffer, startSec, endSec);
  const deltaDb = targetLufs - currentLufs;
  const gainFactor = Math.pow(10, deltaDb / 20);

  const peakRes = calculatePeakNormalization(buffer, 0, startSec, endSec);

  return {
    currentPeakDb: peakRes.currentPeakDb,
    currentLufs: Math.round(currentLufs * 10) / 10,
    gainFactor,
    gainDb: Math.round(deltaDb * 10) / 10,
  };
}

/**
 * Creates a new normalized AudioBuffer with applied gain.
 */
export function applyGainToAudioBuffer(
  audioContext: BaseAudioContext,
  sourceBuffer: AudioBuffer,
  gainFactor: number,
  startSec: number = 0,
  endSec?: number
): AudioBuffer {
  const newBuffer = audioContext.createBuffer(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    sourceBuffer.sampleRate
  );

  const sampleRate = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.floor((endSec ?? sourceBuffer.duration) * sampleRate));

  for (let c = 0; c < sourceBuffer.numberOfChannels; c++) {
    const src = sourceBuffer.getChannelData(c);
    const dest = newBuffer.getChannelData(c);

    // Copy with gain on region
    for (let i = 0; i < sourceBuffer.length; i++) {
      if (i >= startSample && i < endSample) {
        dest[i] = Math.max(-1.0, Math.min(1.0, src[i] * gainFactor));
      } else {
        dest[i] = src[i];
      }
    }
  }

  return newBuffer;
}
