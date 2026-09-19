import { Track, AudioClip } from '../types';

export interface GapInfo {
  gapsCount: number;
  totalGapDuration: number;
}

/**
 * Detects empty spaces/gaps between clips on a track caused by deletions.
 */
export function detectGaps(track: Track): GapInfo {
  if (!track || track.clips.length === 0) {
    return { gapsCount: 0, totalGapDuration: 0 };
  }

  const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
  let gapsCount = 0;
  let totalGapDuration = 0;

  // Check initial gap at start of track
  if (sorted[0].startTime > 0.05) {
    gapsCount++;
    totalGapDuration += sorted[0].startTime;
  }

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].startTime + sorted[i - 1].duration;
    const currentStart = sorted[i].startTime;
    const gap = currentStart - prevEnd;
    if (gap > 0.05) {
      gapsCount++;
      totalGapDuration += gap;
    }
  }

  return { gapsCount, totalGapDuration };
}

/**
 * Removes all empty spaces (gaps) between clips in a single operation.
 * All subsequent clips are shifted left to seamlessly connect with preceding clips.
 */
export function closeTrackGaps(track: Track): {
  newClips: AudioClip[];
  gapsRemoved: number;
  timeSaved: number;
} {
  if (!track || track.clips.length === 0) {
    return { newClips: [], gapsRemoved: 0, timeSaved: 0 };
  }

  const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);
  let gapsRemoved = 0;
  let timeSaved = 0;
  let currentPlacement = 0;

  const newClips: AudioClip[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i];

    if (i === 0) {
      if (clip.startTime > 0.05) {
        gapsRemoved++;
        timeSaved += clip.startTime;
      }
      newClips.push({
        ...clip,
        startTime: 0,
      });
      currentPlacement = clip.duration;
    } else {
      const prevEnd = sorted[i - 1].startTime + sorted[i - 1].duration;
      const originalGap = clip.startTime - prevEnd;
      if (originalGap > 0.05) {
        gapsRemoved++;
        timeSaved += originalGap;
      }

      newClips.push({
        ...clip,
        startTime: currentPlacement,
      });
      currentPlacement += clip.duration;
    }
  }

  return { newClips, gapsRemoved, timeSaved };
}
