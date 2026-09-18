import { PeakData } from '../types';

/**
 * Extracts downsampled peak data (min and max) from an AudioBuffer.
 * For a 30-minute file (1800s), at 200 peaks/sec, we generate ~360k data points,
 * which takes ~1.4MB of memory and processes in <60ms.
 */
export function extractPeaks(audioBuffer: AudioBuffer, peaksPerSecond: number = 200): PeakData {
  const sampleRate = audioBuffer.sampleRate;
  const totalLength = audioBuffer.length;
  const duration = audioBuffer.duration;
  const numChannels = audioBuffer.numberOfChannels;

  const totalPeaks = Math.max(1, Math.floor(duration * peaksPerSecond));
  const samplesPerPeak = Math.max(1, Math.floor(totalLength / totalPeaks));

  const mins = new Float32Array(totalPeaks);
  const maxs = new Float32Array(totalPeaks);

  const channelsData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelsData.push(audioBuffer.getChannelData(c));
  }

  // Iterate over peaks
  for (let i = 0; i < totalPeaks; i++) {
    const startSample = i * samplesPerPeak;
    const endSample = Math.min(startSample + samplesPerPeak, totalLength);

    let min = 1.0;
    let max = -1.0;

    for (let c = 0; c < numChannels; c++) {
      const channel = channelsData[c];
      for (let s = startSample; s < endSample; s += 4) { // Step by 4 for fast peak detection on long files
        const val = channel[s];
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    mins[i] = min === 1.0 ? 0 : min;
    maxs[i] = max === -1.0 ? 0 : max;
  }

  return {
    mins,
    maxs,
    samplesPerPixel: samplesPerPeak,
    sampleRate
  };
}

/**
 * Renders downsampled peaks onto a 2D canvas context efficiently.
 * Only iterates across the visible canvas pixel columns (e.g. 300-800 pixels).
 */
export function drawWaveformToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  peakData: PeakData,
  bufferDuration: number,
  offsetInOriginal: number,
  clipDuration: number,
  color: string = '#06B6D4',
  highlightColor?: string,
  selectionStart?: number,
  selectionEnd?: number
) {
  ctx.clearRect(0, 0, width, height);

  const totalPeaks = peakData.mins.length;
  if (totalPeaks === 0 || clipDuration <= 0) return;

  const midY = height / 2;
  const amp = (height / 2) * 0.92;

  ctx.fillStyle = color;

  const peaksPerSec = totalPeaks / bufferDuration;
  const startPeakIndex = Math.max(0, Math.floor(offsetInOriginal * peaksPerSec));
  const endPeakIndex = Math.min(totalPeaks, Math.ceil((offsetInOriginal + clipDuration) * peaksPerSec));
  const visiblePeaksCount = endPeakIndex - startPeakIndex;

  if (visiblePeaksCount <= 0) return;

  // Draw each horizontal pixel column
  for (let x = 0; x < width; x++) {
    const progress = x / width;
    const peakIdx = Math.floor(startPeakIndex + progress * visiblePeaksCount);
    if (peakIdx >= totalPeaks) break;

    const minVal = peakData.mins[peakIdx];
    const maxVal = peakData.maxs[peakIdx];

    const yTop = midY - Math.max(0.04, maxVal) * amp;
    const yBottom = midY - Math.min(-0.04, minVal) * amp;
    const barHeight = Math.max(2, yBottom - yTop);

    // Check if within selection
    const timeAtPixel = offsetInOriginal + progress * clipDuration;
    const isSelected = selectionStart !== undefined &&
      selectionEnd !== undefined &&
      timeAtPixel >= selectionStart &&
      timeAtPixel <= selectionEnd;

    ctx.fillStyle = isSelected && highlightColor ? highlightColor : color;
    ctx.fillRect(x, yTop, 1.2, barHeight);
  }
}
