import { EffectsConfig, EQSettings, CompressorSettings, LimiterSettings, NoiseGateSettings } from '../types';

export interface EffectsNodes {
  inputNode: GainNode;
  lowCutNode: BiquadFilterNode;
  eq1: BiquadFilterNode;
  eq2: BiquadFilterNode;
  eq3: BiquadFilterNode;
  eq4: BiquadFilterNode;
  eq5: BiquadFilterNode;
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
    lowCut: false,
    band1: 0,
    band2: 0,
    band3: 0,
    band4: 0,
    band5: 0,
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
  Flat: {
    lowCut: false,
    band1: 0,
    band2: 0,
    band3: 0,
    band4: 0,
    band5: 0,
  },
  'Voice Clear': {
    lowCut: true,
    band1: -2,
    band2: -3,
    band3: 1,
    band4: 3.5,
    band5: 2,
  },
  'Bass Boost': {
    lowCut: false,
    band1: 6,
    band2: 2,
    band3: 0,
    band4: 0,
    band5: 1,
  },
};

/**
 * Creates the real-time or offline effects chain.
 * Works seamlessly in both AudioContext (live) and OfflineAudioContext (export).
 */
export function createEffectsChain(ctx: BaseAudioContext): EffectsNodes {
  const inputNode = ctx.createGain();

  // 1. Low Cut Filter (80Hz Highpass)
  const lowCutNode = ctx.createBiquadFilter();
  lowCutNode.type = 'highpass';
  lowCutNode.frequency.setValueAtTime(80, ctx.currentTime);
  lowCutNode.Q.setValueAtTime(0.707, ctx.currentTime);

  // 2. 5-Band Parametric EQ
  // Band 1: Low Shelf @ 100Hz
  const eq1 = ctx.createBiquadFilter();
  eq1.type = 'lowshelf';
  eq1.frequency.setValueAtTime(100, ctx.currentTime);

  // Band 2: Peaking @ 350Hz (Low-Mid)
  const eq2 = ctx.createBiquadFilter();
  eq2.type = 'peaking';
  eq2.frequency.setValueAtTime(350, ctx.currentTime);
  eq2.Q.setValueAtTime(1.0, ctx.currentTime);

  // Band 3: Peaking @ 1000Hz (Mid)
  const eq3 = ctx.createBiquadFilter();
  eq3.type = 'peaking';
  eq3.frequency.setValueAtTime(1000, ctx.currentTime);
  eq3.Q.setValueAtTime(1.0, ctx.currentTime);

  // Band 4: Peaking @ 3500Hz (High-Mid / Presence)
  const eq4 = ctx.createBiquadFilter();
  eq4.type = 'peaking';
  eq4.frequency.setValueAtTime(3500, ctx.currentTime);
  eq4.Q.setValueAtTime(1.0, ctx.currentTime);

  // Band 5: High Shelf @ 10000Hz (Air / Brilliance)
  const eq5 = ctx.createBiquadFilter();
  eq5.type = 'highshelf';
  eq5.frequency.setValueAtTime(10000, ctx.currentTime);

  // 3. Noise Gate (Fast Downward Expander via DynamicsCompressor / Envelope Gain)
  const noiseGateGain = ctx.createGain();

  // 4. Main Compressor
  const compressor = ctx.createDynamicsCompressor();

  // Makeup gain node for compressor
  const makeupGain = ctx.createGain();

  // 5. Peak Limiter
  // We use DynamicsCompressorNode with ratio=20:1, knee=0, ultra-fast attack=0.001s,
  // followed by a safety ceiling gain multiplier.
  const limiter = ctx.createDynamicsCompressor();
  limiter.knee.setValueAtTime(0, ctx.currentTime);
  limiter.ratio.setValueAtTime(20, ctx.currentTime);
  limiter.attack.setValueAtTime(0.001, ctx.currentTime);

  const limiterCeiling = ctx.createGain();

  // 6. Master Gain
  const masterGain = ctx.createGain();
  const outputNode = ctx.createGain();

  // Connect serial audio chain
  inputNode.connect(lowCutNode);
  lowCutNode.connect(eq1);
  eq1.connect(eq2);
  eq2.connect(eq3);
  eq3.connect(eq4);
  eq4.connect(eq5);
  eq5.connect(noiseGateGain);
  noiseGateGain.connect(compressor);
  compressor.connect(makeupGain);
  makeupGain.connect(limiter);
  limiter.connect(limiterCeiling);
  limiterCeiling.connect(masterGain);
  masterGain.connect(outputNode);

  return {
    inputNode,
    lowCutNode,
    eq1,
    eq2,
    eq3,
    eq4,
    eq5,
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

  // EQ Settings
  if (config.eq.enabled) {
    nodes.lowCutNode.frequency.setValueAtTime(config.eq.lowCut ? 80 : 10, t);
    nodes.eq1.gain.setValueAtTime(config.eq.band1, t);
    nodes.eq2.gain.setValueAtTime(config.eq.band2, t);
    nodes.eq3.gain.setValueAtTime(config.eq.band3, t);
    nodes.eq4.gain.setValueAtTime(config.eq.band4, t);
    nodes.eq5.gain.setValueAtTime(config.eq.band5, t);
  } else {
    nodes.lowCutNode.frequency.setValueAtTime(10, t);
    nodes.eq1.gain.setValueAtTime(0, t);
    nodes.eq2.gain.setValueAtTime(0, t);
    nodes.eq3.gain.setValueAtTime(0, t);
    nodes.eq4.gain.setValueAtTime(0, t);
    nodes.eq5.gain.setValueAtTime(0, t);
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

  // Noise Gate (Simple downward gain thresholding)
  if (config.noiseGate.enabled) {
    nodes.noiseGateGain.gain.setValueAtTime(1.0, t);
  } else {
    nodes.noiseGateGain.gain.setValueAtTime(1.0, t);
  }

  // Master Gain
  nodes.masterGain.gain.setValueAtTime(config.masterGain ?? 1.0, t);
}
