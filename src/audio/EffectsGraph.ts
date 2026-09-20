import { EffectsConfig, EQSettings, CompressorSettings, LimiterSettings, NoiseGateSettings } from '../types';

export interface EffectsNodes {
  inputNode: GainNode;
  preampNode: GainNode;
  eq1: BiquadFilterNode;
  eq2: BiquadFilterNode;
  eq3: BiquadFilterNode;
  eq4: BiquadFilterNode;
  eq5: BiquadFilterNode;
  eq6: BiquadFilterNode;
  eq7: BiquadFilterNode;
  eq8: BiquadFilterNode;
  eq9: BiquadFilterNode;
  eq10: BiquadFilterNode;
  noiseGateGain: GainNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  limiter: DynamicsCompressorNode;
  limiterCeiling: GainNode;
  masterGain: GainNode;
  outputNode: GainNode;
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  eq: {
    enabled: true,
    preamp: 0,
    band1: 0, // 32Hz
    band2: 0, // 62Hz
    band3: 0, // 125Hz
    band4: 0, // 250Hz
    band5: 0, // 500Hz
    band6: 0, // 1000Hz
    band7: 0, // 2000Hz
    band8: 0, // 4000Hz
    band9: 0, // 8000Hz
    band10: 0, // 16000Hz
  },
  compressor: {
    enabled: false,
    threshold: -24,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
    makeupGain: 0,
  },
  limiter: {
    enabled: true,
    ceiling: -0.5,
    release: 0.05,
  },
  noiseGate: {
    enabled: false,
    threshold: -50,
    attack: 0.01,
    release: 0.15,
  },
  masterGain: 1.0,
};

export const EQ_PRESETS: Record<string, Partial<EQSettings>> = {
  'Flat': {
    preamp: 0,
    band1: 0,
    band2: 0,
    band3: 0,
    band4: 0,
    band5: 0,
    band6: 0,
    band7: 0,
    band8: 0,
    band9: 0,
    band10: 0,
  },
  'Voice Clear': {
    preamp: 0,
    band1: -4,
    band2: -2,
    band3: 0,
    band4: 1,
    band5: 2,
    band6: 3,
    band7: 4,
    band8: 3,
    band9: 1,
    band10: -2,
  },
  'Bass Boost': {
    preamp: 2,
    band1: 8,
    band2: 6,
    band3: 4,
    band4: 1,
    band5: 0,
    band6: 0,
    band7: 0,
    band8: 1,
    band9: 2,
    band10: 2,
  },
  'Radio Broadcast': {
    preamp: 1,
    band1: 5,
    band2: 3,
    band3: 1,
    band4: -1,
    band5: 2,
    band6: 4,
    band7: 5,
    band8: 4,
    band9: 2,
    band10: 0,
  },
  'Podcast Warmth': {
    preamp: 1,
    band1: 4,
    band2: 3,
    band3: 2,
    band4: 1,
    band5: 0,
    band6: 1,
    band7: 2,
    band8: 2,
    band9: 1,
    band10: 0,
  },
  'Telephone / Lo-Fi': {
    preamp: 0,
    band1: -12,
    band2: -10,
    band3: -4,
    band4: 6,
    band5: 8,
    band6: 6,
    band7: 2,
    band8: -4,
    band9: -10,
    band10: -15,
  },
  'Presence & Crisp': {
    preamp: 0,
    band1: 0,
    band2: 0,
    band3: 0,
    band4: 1,
    band5: 2,
    band6: 3,
    band7: 5,
    band8: 6,
    band9: 5,
    band10: 4,
  },
  'Rock / Pop Vibe': {
    preamp: 2,
    band1: 5,
    band2: 4,
    band3: 1,
    band4: -1,
    band5: -2,
    band6: 1,
    band7: 3,
    band8: 5,
    band9: 6,
    band10: 6,
  },
};

export const COMPRESSOR_PRESETS: Record<string, Partial<CompressorSettings>> = {
  'Vocal Smooth': { enabled: true, threshold: -20, ratio: 3, attack: 0.015, release: 0.2, makeupGain: 2 },
  'Heavy Punch': { enabled: true, threshold: -32, ratio: 6, attack: 0.005, release: 0.15, makeupGain: 4 },
  'Podcast Leveler': { enabled: true, threshold: -24, ratio: 4, attack: 0.01, release: 0.25, makeupGain: 3 },
  'Dynamic Control': { enabled: true, threshold: -18, ratio: 2.5, attack: 0.03, release: 0.4, makeupGain: 1 },
};

export const LIMITER_PRESETS: Record<string, Partial<LimiterSettings>> = {
  'Standard (-0.5dB)': { enabled: true, ceiling: -0.5, release: 0.05 },
  'Broadcast Safe (-1dB)': { enabled: true, ceiling: -1.0, release: 0.05 },
  'Maximum Loudness (-0.1dB)': { enabled: true, ceiling: -0.1, release: 0.02 },
  'Dynamic Safe (-2dB)': { enabled: true, ceiling: -2.0, release: 0.1 },
};

export const NOISE_GATE_PRESETS: Record<string, Partial<NoiseGateSettings>> = {
  'Gentle Gate (-45dB)': { enabled: true, threshold: -45, attack: 0.005, release: 0.1 },
  'Aggressive Gate (-35dB)': { enabled: true, threshold: -35, attack: 0.002, release: 0.08 },
  'Studio Silence (-55dB)': { enabled: true, threshold: -55, attack: 0.01, release: 0.2 },
};

/**
 * Creates the real-time or offline effects chain.
 * Works seamlessly in both AudioContext (live) and OfflineAudioContext (export).
 */
export function createEffectsChain(ctx: BaseAudioContext): EffectsNodes {
  const inputNode = ctx.createGain();
  const preampNode = ctx.createGain();

  // 10-Band Graphic EQ Filters (32Hz to 16kHz)
  const eq1 = ctx.createBiquadFilter();
  eq1.type = 'lowshelf';
  eq1.frequency.setValueAtTime(32, ctx.currentTime);

  const eq2 = ctx.createBiquadFilter();
  eq2.type = 'peaking';
  eq2.frequency.setValueAtTime(62, ctx.currentTime);
  eq2.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq3 = ctx.createBiquadFilter();
  eq3.type = 'peaking';
  eq3.frequency.setValueAtTime(125, ctx.currentTime);
  eq3.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq4 = ctx.createBiquadFilter();
  eq4.type = 'peaking';
  eq4.frequency.setValueAtTime(250, ctx.currentTime);
  eq4.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq5 = ctx.createBiquadFilter();
  eq5.type = 'peaking';
  eq5.frequency.setValueAtTime(500, ctx.currentTime);
  eq5.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq6 = ctx.createBiquadFilter();
  eq6.type = 'peaking';
  eq6.frequency.setValueAtTime(1000, ctx.currentTime);
  eq6.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq7 = ctx.createBiquadFilter();
  eq7.type = 'peaking';
  eq7.frequency.setValueAtTime(2000, ctx.currentTime);
  eq7.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq8 = ctx.createBiquadFilter();
  eq8.type = 'peaking';
  eq8.frequency.setValueAtTime(4000, ctx.currentTime);
  eq8.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq9 = ctx.createBiquadFilter();
  eq9.type = 'peaking';
  eq9.frequency.setValueAtTime(8000, ctx.currentTime);
  eq9.Q.setValueAtTime(1.4, ctx.currentTime);

  const eq10 = ctx.createBiquadFilter();
  eq10.type = 'highshelf';
  eq10.frequency.setValueAtTime(16000, ctx.currentTime);

  // Noise Gate
  const noiseGateGain = ctx.createGain();

  // Compressor & Makeup
  const compressor = ctx.createDynamicsCompressor();
  const makeupGain = ctx.createGain();

  // Peak Limiter
  const limiter = ctx.createDynamicsCompressor();
  limiter.knee.setValueAtTime(0, ctx.currentTime);
  limiter.ratio.setValueAtTime(20, ctx.currentTime);
  limiter.attack.setValueAtTime(0.001, ctx.currentTime);

  const limiterCeiling = ctx.createGain();

  // Master Gain & Output
  const masterGain = ctx.createGain();
  const outputNode = ctx.createGain();

  // Connect serial audio chain
  inputNode.connect(preampNode);
  preampNode.connect(eq1);
  eq1.connect(eq2);
  eq2.connect(eq3);
  eq3.connect(eq4);
  eq4.connect(eq5);
  eq5.connect(eq6);
  eq6.connect(eq7);
  eq7.connect(eq8);
  eq8.connect(eq9);
  eq9.connect(eq10);
  eq10.connect(noiseGateGain);
  noiseGateGain.connect(compressor);
  compressor.connect(makeupGain);
  makeupGain.connect(limiter);
  limiter.connect(limiterCeiling);
  limiterCeiling.connect(masterGain);
  masterGain.connect(outputNode);

  return {
    inputNode,
    preampNode,
    eq1,
    eq2,
    eq3,
    eq4,
    eq5,
    eq6,
    eq7,
    eq8,
    eq9,
    eq10,
    noiseGateGain,
    compressor,
    makeupGain,
    limiter,
    limiterCeiling,
    masterGain,
    outputNode,
  };
}

/**
 * Updates an existing node chain with new effects configuration.
 */
export function applyEffectsConfig(nodes: EffectsNodes, config: EffectsConfig, ctx: BaseAudioContext) {
  const t = ctx.currentTime;

  // EQ Settings (10-Band Graphic EQ + Preamp)
  if (config.eq.enabled) {
    const preampLinear = Math.pow(10, (config.eq.preamp ?? 0) / 20);
    nodes.preampNode.gain.setValueAtTime(preampLinear, t);

    nodes.eq1.gain.setValueAtTime(config.eq.band1, t);
    nodes.eq2.gain.setValueAtTime(config.eq.band2, t);
    nodes.eq3.gain.setValueAtTime(config.eq.band3, t);
    nodes.eq4.gain.setValueAtTime(config.eq.band4, t);
    nodes.eq5.gain.setValueAtTime(config.eq.band5, t);
    nodes.eq6.gain.setValueAtTime(config.eq.band6, t);
    nodes.eq7.gain.setValueAtTime(config.eq.band7, t);
    nodes.eq8.gain.setValueAtTime(config.eq.band8, t);
    nodes.eq9.gain.setValueAtTime(config.eq.band9, t);
    nodes.eq10.gain.setValueAtTime(config.eq.band10, t);
  } else {
    nodes.preampNode.gain.setValueAtTime(1.0, t);
    nodes.eq1.gain.setValueAtTime(0, t);
    nodes.eq2.gain.setValueAtTime(0, t);
    nodes.eq3.gain.setValueAtTime(0, t);
    nodes.eq4.gain.setValueAtTime(0, t);
    nodes.eq5.gain.setValueAtTime(0, t);
    nodes.eq6.gain.setValueAtTime(0, t);
    nodes.eq7.gain.setValueAtTime(0, t);
    nodes.eq8.gain.setValueAtTime(0, t);
    nodes.eq9.gain.setValueAtTime(0, t);
    nodes.eq10.gain.setValueAtTime(0, t);
  }

  // Compressor Settings
  if (config.compressor.enabled) {
    nodes.compressor.threshold.setValueAtTime(config.compressor.threshold, t);
    nodes.compressor.ratio.setValueAtTime(config.compressor.ratio, t);
    nodes.compressor.attack.setValueAtTime(config.compressor.attack, t);
    nodes.compressor.release.setValueAtTime(config.compressor.release, t);
    const linearMakeup = Math.pow(10, config.compressor.makeupGain / 20);
    nodes.makeupGain.gain.setValueAtTime(linearMakeup, t);
  } else {
    nodes.compressor.threshold.setValueAtTime(0, t);
    nodes.compressor.ratio.setValueAtTime(1, t);
    nodes.makeupGain.gain.setValueAtTime(1.0, t);
  }

  // Limiter Settings
  if (config.limiter.enabled) {
    nodes.limiter.threshold.setValueAtTime(config.limiter.ceiling, t);
    nodes.limiter.release.setValueAtTime(config.limiter.release, t);
    const ceilingLinear = Math.pow(10, config.limiter.ceiling / 20);
    nodes.limiterCeiling.gain.setValueAtTime(Math.min(1.0, ceilingLinear), t);
  } else {
    nodes.limiter.threshold.setValueAtTime(0, t);
    nodes.limiterCeiling.gain.setValueAtTime(1.0, t);
  }

  // Noise Gate
  if (config.noiseGate.enabled) {
    nodes.noiseGateGain.gain.setValueAtTime(1.0, t);
  } else {
    nodes.noiseGateGain.gain.setValueAtTime(1.0, t);
  }

  // Master Gain
  nodes.masterGain.gain.setValueAtTime(config.masterGain ?? 1.0, t);
}
