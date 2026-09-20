export interface AudioClip {
  id: string;
  trackId: string;
  bufferId: string;
  name: string;
  startTime: number; // Timeline position in seconds
  offsetInOriginal: number; // Offset in original audio buffer in seconds
  duration: number; // Duration of clip in seconds
  volume: number; // Linear volume multiplier (0..2)
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
  speed: number; // Speed factor (0.5..2.0)
  pitch: number; // Semitone shift (-12..+12)
}

export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number; // 0..2 (1.0 = 100%)
  isMuted: boolean;
  isSoloed: boolean;
  timeOffset: number; // in seconds
  clips: AudioClip[];
}

export interface EQSettings {
  enabled: boolean;
  preamp: number; // dB (-20..+20)
  band1: number; // 32Hz (-20..+20 dB)
  band2: number; // 62Hz
  band3: number; // 125Hz
  band4: number; // 250Hz
  band5: number; // 500Hz
  band6: number; // 1000Hz
  band7: number; // 2000Hz
  band8: number; // 4000Hz
  band9: number; // 8000Hz
  band10: number; // 16000Hz
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number; // dB (-60..0)
  ratio: number; // 1..20
  attack: number; // seconds (0.001..0.5)
  release: number; // seconds (0.05..1.0)
  makeupGain: number; // dB (0..24)
}

export interface LimiterSettings {
  enabled: boolean;
  ceiling: number; // dB (-12..0)
  release: number; // seconds (0.01..0.5)
}

export interface NoiseGateSettings {
  enabled: boolean;
  threshold: number; // dB (-80..-20)
  attack: number; // seconds (0.001..0.1)
  release: number; // seconds (0.05..1.0)
}

export interface EffectsConfig {
  eq: EQSettings;
  compressor: CompressorSettings;
  limiter: LimiterSettings;
  noiseGate: NoiseGateSettings;
  masterGain: number; // Linear 0..2
}

export interface TimelineSelection {
  trackId?: string;
  clipId?: string;
  startTime: number;
  endTime: number;
}

export interface SilenceRegion {
  start: number;
  end: number;
}

export interface ProjectState {
  id: string;
  title: string;
  tracks: Track[];
  effects: EffectsConfig;
  duration: number; // Maximum timeline end time in seconds
  updatedAt: number;
}

export interface PeakData {
  mins: Float32Array;
  maxs: Float32Array;
  samplesPerPixel: number;
  sampleRate: number;
}

export interface AudioBufferMetadata {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}
