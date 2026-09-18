import { Track, EffectsConfig, AudioClip, PeakData } from '../types';
import { createEffectsChain, applyEffectsConfig, EffectsNodes, DEFAULT_EFFECTS } from './EffectsGraph';
import { extractPeaks } from './PeakExtractor';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private effectsNodes: EffectsNodes | null = null;
  private trackNodes: Map<string, GainNode> = new Map();
  private activeSources: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private peakCache: Map<string, PeakData> = new Map();

  private isPlaying: boolean = false;
  private startTimeOffset: number = 0; // Timeline time where playback was started
  private playContextStartTime: number = 0; // ctx.currentTime when playback was started
  private tracks: Track[] = [];
  private effectsConfig: EffectsConfig = DEFAULT_EFFECTS;

  private isLooping: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 0;

  private animFrameId: number | null = null;
  private onTimeUpdateCallback?: (time: number) => void;
  private onStateChangeCallback?: (isPlaying: boolean) => void;

  constructor() {
    // Lazy initialize on user gesture to obey autoplay policy
  }

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.effectsNodes = createEffectsChain(this.ctx);
      applyEffectsConfig(this.effectsNodes, this.effectsConfig, this.ctx);
      this.effectsNodes.outputNode.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.startTimeOffset;
    }
    const elapsed = this.ctx.currentTime - this.playContextStartTime;
    let current = this.startTimeOffset + elapsed;

    if (this.isLooping && this.loopEnd > this.loopStart) {
      const loopLen = this.loopEnd - this.loopStart;
      if (current >= this.loopEnd) {
        // Schedule next loop iteration
        this.seek(this.loopStart);
        this.play(this.loopStart);
        return this.loopStart;
      }
    }

    return current;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setTracks(tracks: Track[]) {
    this.tracks = tracks;
    this.updateTrackRouting();
  }

  setEffects(config: EffectsConfig) {
    this.effectsConfig = config;
    if (this.ctx && this.effectsNodes) {
      applyEffectsConfig(this.effectsNodes, config, this.ctx);
    }
  }

  setLoop(enabled: boolean, startSec: number = 0, endSec: number = 0) {
    this.isLooping = enabled;
    this.loopStart = Math.max(0, startSec);
    this.loopEnd = Math.max(startSec, endSec);
  }

  registerBuffer(bufferId: string, buffer: AudioBuffer): PeakData {
    this.bufferCache.set(bufferId, buffer);
    let peaks = this.peakCache.get(bufferId);
    if (!peaks) {
      peaks = extractPeaks(buffer, 200);
      this.peakCache.set(bufferId, peaks);
    }
    return peaks;
  }

  getBuffer(bufferId: string): AudioBuffer | undefined {
    return this.bufferCache.get(bufferId);
  }

  getPeaks(bufferId: string): PeakData | undefined {
    return this.peakCache.get(bufferId);
  }

  async decodeAudioFile(file: File | Blob): Promise<{ bufferId: string; audioBuffer: AudioBuffer; peakData: PeakData }> {
    const ctx = this.initContext();
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use slice to protect original buffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const bufferId = `buf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const peakData = this.registerBuffer(bufferId, audioBuffer);
      return { bufferId, audioBuffer, peakData };
    } catch (err: any) {
      throw new Error(`Unsupported or corrupt audio file format: ${err.message || 'Decoding failed'}`);
    }
  }

  private updateTrackRouting() {
    if (!this.ctx || !this.effectsNodes) return;

    const hasSolo = this.tracks.some((t) => t.isSoloed);

    for (const track of this.tracks) {
      let gainNode = this.trackNodes.get(track.id);
      if (!gainNode) {
        gainNode = this.ctx.createGain();
        gainNode.connect(this.effectsNodes.inputNode);
        this.trackNodes.set(track.id, gainNode);
      }

      const shouldMute = track.isMuted || (hasSolo && !track.isSoloed);
      const targetGain = shouldMute ? 0 : track.volume;
      gainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  async play(startFromSec?: number) {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.isPlaying) {
      this.stopActiveSources();
    }

    const startTime = startFromSec !== undefined ? Math.max(0, startFromSec) : this.startTimeOffset;
    this.startTimeOffset = startTime;
    this.playContextStartTime = ctx.currentTime;
    this.isPlaying = true;

    this.updateTrackRouting();
    this.scheduleClipsFromTime(startTime);

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(true);
    }

    this.startTimeTicker();
  }

  pause() {
    if (!this.isPlaying) return;
    this.startTimeOffset = this.getCurrentTime();
    this.stopActiveSources();
    this.isPlaying = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(false);
    }
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.startTimeOffset);
    }
  }

  stop() {
    this.pause();
    this.startTimeOffset = 0;
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }
  }

  seek(timeSec: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.startTimeOffset = Math.max(0, timeSec);
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.startTimeOffset);
    }
    if (wasPlaying) {
      this.play(this.startTimeOffset);
    }
  }

  private scheduleClipsFromTime(timelineTime: number) {
    if (!this.ctx || !this.effectsNodes) return;

    this.stopActiveSources();

    const maxProjectTime = this.calculateProjectDuration();
    if (timelineTime > maxProjectTime && !this.isLooping) {
      this.pause();
      return;
    }

    const hasSolo = this.tracks.some((t) => t.isSoloed);

    for (const track of this.tracks) {
      if (track.isMuted || (hasSolo && !track.isSoloed)) {
        continue;
      }

      let trackGainNode = this.trackNodes.get(track.id);
      if (!trackGainNode) {
        trackGainNode = this.ctx.createGain();
        trackGainNode.connect(this.effectsNodes.inputNode);
        this.trackNodes.set(track.id, trackGainNode);
      }

      for (const clip of track.clips) {
        const buffer = this.bufferCache.get(clip.bufferId);
        if (!buffer) continue;

        const clipStartOnTimeline = clip.startTime + track.timeOffset;
        const clipEndOnTimeline = clipStartOnTimeline + clip.duration;

        // Only schedule if clip has audio in future of timelineTime
        if (clipEndOnTimeline <= timelineTime) {
          continue;
        }

        let scheduleDelay = 0;
        let offsetIntoClip = 0;

        if (clipStartOnTimeline >= timelineTime) {
          // Clip starts in future
          scheduleDelay = clipStartOnTimeline - timelineTime;
          offsetIntoClip = 0;
        } else {
          // Clip started before timelineTime and is currently overlapping
          scheduleDelay = 0;
          offsetIntoClip = timelineTime - clipStartOnTimeline;
        }

        const remainingClipDuration = clip.duration - offsetIntoClip;
        const startOffsetInOriginal = clip.offsetInOriginal + offsetIntoClip;

        if (remainingClipDuration <= 0 || startOffsetInOriginal >= buffer.duration) {
          continue;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Clip-level Gain Node (for clip volume and fade in/out)
        const clipGain = this.ctx.createGain();
        const baseVol = clip.volume ?? 1.0;
        const ctxStartAt = this.ctx.currentTime + scheduleDelay;

        // Fade in handling
        if (clip.fadeIn > 0 && offsetIntoClip < clip.fadeIn) {
          const fadeRemain = clip.fadeIn - offsetIntoClip;
          const currentGain = (offsetIntoClip / clip.fadeIn) * baseVol;
          clipGain.gain.setValueAtTime(currentGain, ctxStartAt);
          clipGain.gain.linearRampToValueAtTime(baseVol, ctxStartAt + fadeRemain);
        } else {
          clipGain.gain.setValueAtTime(baseVol, ctxStartAt);
        }

        // Fade out handling
        if (clip.fadeOut > 0) {
          const fadeStartOnTimeline = clipEndOnTimeline - clip.fadeOut;
          const fadeStartCtxTime = this.ctx.currentTime + Math.max(0, fadeStartOnTimeline - timelineTime);
          const fadeLen = Math.min(clip.fadeOut, remainingClipDuration);
          clipGain.gain.setValueAtTime(baseVol, fadeStartCtxTime);
          clipGain.gain.linearRampToValueAtTime(0, ctxStartCtxTimeSafe(ctxStartAt, remainingClipDuration));
        }

        source.connect(clipGain);
        clipGain.connect(trackGainNode);

        source.start(ctxStartAt, startOffsetInOriginal, remainingClipDuration);
        this.activeSources.push({ source, gain: clipGain });
      }
    }
  }

  private stopActiveSources() {
    for (const item of this.activeSources) {
      try {
        item.source.stop();
        item.source.disconnect();
        item.gain.disconnect();
      } catch (e) {
        // Source may have already stopped
      }
    }
    this.activeSources = [];
  }

  private calculateProjectDuration(): number {
    let max = 0;
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + track.timeOffset + clip.duration;
        if (end > max) max = end;
      }
    }
    return max;
  }

  private startTimeTicker() {
    const tick = () => {
      if (!this.isPlaying) return;

      const current = this.getCurrentTime();
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(current);
      }

      const totalDur = this.calculateProjectDuration();
      if (totalDur > 0 && current >= totalDur && !this.isLooping) {
        this.pause();
        this.seek(0);
        return;
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  onTimeUpdate(cb: (time: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  onStateChange(cb: (isPlaying: boolean) => void) {
    this.onStateChangeCallback = cb;
  }

  getAllBuffers(): Map<string, AudioBuffer> {
    return this.bufferCache;
  }
}

function ctxStartCtxTimeSafe(start: number, dur: number): number {
  return start + dur;
}
