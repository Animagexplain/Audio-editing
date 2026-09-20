import React, { useState } from 'react';
import { EffectsConfig, EQSettings, CompressorSettings, LimiterSettings, NoiseGateSettings, AudioClip } from '../../types';
import { EQ_PRESETS, COMPRESSOR_PRESETS, LIMITER_PRESETS, NOISE_GATE_PRESETS } from '../../audio/EffectsGraph';
import { calculatePeakNormalization, calculateLoudnessNormalization, applyGainToAudioBuffer } from '../../audio/Normalization';
import { AudioEngine } from '../../audio/AudioEngine';
import { Activity, Sliders, ShieldAlert, Disc, Check, Sparkles, RotateCcw } from 'lucide-react';

interface EffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  effects: EffectsConfig;
  onChangeEffects: (newEffects: EffectsConfig) => void;
  audioEngine: AudioEngine;
  selectedClip: AudioClip | null;
  onUpdateClip: (clip: AudioClip) => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
  isOpen,
  onClose,
  effects,
  onChangeEffects,
  audioEngine,
  selectedClip,
  onUpdateClip,
}) => {
  const [activeTab, setActiveTab] = useState<'eq' | 'comp' | 'limiter' | 'gate' | 'normalize'>('eq');

  // Normalization State
  const [normMode, setNormMode] = useState<'peak' | 'lufs'>('lufs');
  const [peakTargetDb, setPeakTargetDb] = useState<number>(-0.5);
  const [lufsTarget, setLufsTarget] = useState<number>(-14);
  const [normResultText, setNormResultText] = useState<string>('');

  if (!isOpen) return null;

  // Apply EQ Preset
  const handleApplyPreset = (presetName: string) => {
    const preset = EQ_PRESETS[presetName];
    if (!preset) return;
    onChangeEffects({
      ...effects,
      eq: {
        ...effects.eq,
        ...preset,
      } as EQSettings,
    });
  };

  const handleApplyCompPreset = (presetName: string) => {
    const preset = COMPRESSOR_PRESETS[presetName];
    if (!preset) return;
    onChangeEffects({
      ...effects,
      compressor: { ...effects.compressor, ...preset } as CompressorSettings,
    });
  };

  const handleApplyLimiterPreset = (presetName: string) => {
    const preset = LIMITER_PRESETS[presetName];
    if (!preset) return;
    onChangeEffects({
      ...effects,
      limiter: { ...effects.limiter, ...preset } as LimiterSettings,
    });
  };

  const handleApplyGatePreset = (presetName: string) => {
    const preset = NOISE_GATE_PRESETS[presetName];
    if (!preset) return;
    onChangeEffects({
      ...effects,
      noiseGate: { ...effects.noiseGate, ...preset } as NoiseGateSettings,
    });
  };

  const handleResetEq = () => {
    onChangeEffects({
      ...effects,
      eq: {
        enabled: true,
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
    });
  };

  const handleResetCompressor = () => {
    onChangeEffects({
      ...effects,
      compressor: { enabled: false, threshold: -24, ratio: 4, attack: 0.01, release: 0.25, makeupGain: 0 },
    });
  };

  const handleResetLimiter = () => {
    onChangeEffects({
      ...effects,
      limiter: { enabled: true, ceiling: -0.5, release: 0.05 },
    });
  };

  const handleResetNoiseGate = () => {
    onChangeEffects({
      ...effects,
      noiseGate: { enabled: false, threshold: -50, attack: 0.01, release: 0.15 },
    });
  };

  const handleResetNormalize = () => {
    setNormMode('lufs');
    setPeakTargetDb(-3.0);
    setLufsTarget(-14);
    setNormResultText('');
  };

  // Run Normalization
  const handleRunNormalization = () => {
    if (!selectedClip) {
      alert('Please select an audio clip on the timeline to normalize.');
      return;
    }
    const buffer = audioEngine.getBuffer(selectedClip.bufferId);
    if (!buffer) return;

    if (normMode === 'peak') {
      const res = calculatePeakNormalization(buffer, peakTargetDb, selectedClip.offsetInOriginal, selectedClip.offsetInOriginal + selectedClip.duration);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newBuf = applyGainToAudioBuffer(audioCtx, buffer, res.gainFactor, selectedClip.offsetInOriginal, selectedClip.offsetInOriginal + selectedClip.duration);
      const newBufId = `buf_norm_${Date.now()}`;
      audioEngine.registerBuffer(newBufId, newBuf);
      onUpdateClip({ ...selectedClip, bufferId: newBufId });
      setNormResultText(`Peak Normalized: ${res.currentPeakDb.toFixed(1)} dBFS → ${peakTargetDb} dBFS (Gain: ${res.gainDb > 0 ? '+' : ''}${res.gainDb.toFixed(1)} dB)`);
    } else {
      const res = calculateLoudnessNormalization(buffer, lufsTarget, selectedClip.offsetInOriginal, selectedClip.offsetInOriginal + selectedClip.duration);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newBuf = applyGainToAudioBuffer(audioCtx, buffer, res.gainFactor, selectedClip.offsetInOriginal, selectedClip.offsetInOriginal + selectedClip.duration);
      const newBufId = `buf_norm_${Date.now()}`;
      audioEngine.registerBuffer(newBufId, newBuf);
      onUpdateClip({ ...selectedClip, bufferId: newBufId });
      setNormResultText(`Loudness Normalized: ${res.currentLufs} LUFS → ${lufsTarget} LUFS (Gain: ${res.gainDb > 0 ? '+' : ''}${res.gainDb.toFixed(1)} dB)`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border-t border-slate-700 rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-sm text-slate-100">Master Effects & Processing</h3>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 sm:flex border-b border-slate-800 bg-slate-950/60 p-2 gap-1.5">
          {[
            { id: 'eq', label: '5-Band EQ' },
            { id: 'comp', label: 'Compressor' },
            { id: 'limiter', label: 'Limiter' },
            { id: 'gate', label: 'Noise Gate' },
            { id: 'normalize', label: 'Normalize' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* TAB 1: 5-Band EQ + Low Cut */}
          {activeTab === 'eq' && (
            <div className="space-y-4">
              {/* Presets and Enable switch */}
              <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.eq.enabled}
                      onChange={(e) =>
                        onChangeEffects({
                          ...effects,
                          eq: { ...effects.eq, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">Enable EQ</span>
                  </label>

                  <button
                    onClick={handleResetEq}
                    className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
                    title="Reset EQ to default"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    <span>Reset EQ</span>
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1 shrink-0">Presets:</span>
                  {Object.keys(EQ_PRESETS).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleApplyPreset(preset)}
                      className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all shrink-0"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pre amplifier slider */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-200">Pre amplifier</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {(effects.eq.preamp ?? 0) > 0 ? `+${effects.eq.preamp}` : (effects.eq.preamp ?? 0)} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={effects.eq.preamp ?? 0}
                  onChange={(e) =>
                    onChangeEffects({
                      ...effects,
                      eq: {
                        ...effects.eq,
                        preamp: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              {/* 10-Band Graphic EQ Frequencies */}
              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 pb-1 border-b border-slate-800">
                  10-Band Graphic Equalizer (-20dB to +20dB)
                </div>
                {[
                  { key: 'band1', freq: '32 Hz', label: 'Sub Bass' },
                  { key: 'band2', freq: '62 Hz', label: 'Bass' },
                  { key: 'band3', freq: '125 Hz', label: 'Low Mid' },
                  { key: 'band4', freq: '250 Hz', label: 'Mid' },
                  { key: 'band5', freq: '500 Hz', label: 'Upper Mid' },
                  { key: 'band6', freq: '1,000 Hz', label: 'Presence' },
                  { key: 'band7', freq: '2,000 Hz', label: 'High Mid' },
                  { key: 'band8', freq: '4,000 Hz', label: 'Treble' },
                  { key: 'band9', freq: '8,000 Hz', label: 'Brilliance' },
                  { key: 'band10', freq: '16,000 Hz', label: 'Air' },
                ].map((band) => {
                  const val = (effects.eq as any)[band.key] || 0;
                  return (
                    <div key={band.key} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-300 font-medium">
                          {band.freq} <span className="text-slate-400 text-[10px]">({band.label})</span>
                        </span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {val > 0 ? `+${val}` : val} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="0.5"
                        value={val}
                        onChange={(e) =>
                          onChangeEffects({
                            ...effects,
                            eq: {
                              ...effects.eq,
                              [band.key]: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Compressor */}
          {activeTab === 'comp' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.compressor.enabled}
                      onChange={(e) =>
                        onChangeEffects({
                          ...effects,
                          compressor: { ...effects.compressor, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">Enable Compressor</span>
                  </label>

                  <button
                    onClick={handleResetCompressor}
                    className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
                    title="Reset Compressor to default"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    <span>Reset Comp</span>
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1 shrink-0">Presets:</span>
                  {Object.keys(COMPRESSOR_PRESETS).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleApplyCompPreset(preset)}
                      className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all shrink-0"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {/* Threshold */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Threshold</span>
                    <span className="font-mono text-cyan-300">{effects.compressor.threshold} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="0"
                    step="1"
                    value={effects.compressor.threshold}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        compressor: { ...effects.compressor, threshold: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Ratio */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Ratio</span>
                    <span className="font-mono text-cyan-300">{effects.compressor.ratio}:1</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={effects.compressor.ratio}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        compressor: { ...effects.compressor, ratio: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Attack */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Attack</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(effects.compressor.attack * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.001"
                    max="0.2"
                    step="0.005"
                    value={effects.compressor.attack}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        compressor: { ...effects.compressor, attack: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Release */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Release</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(effects.compressor.release * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={effects.compressor.release}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        compressor: { ...effects.compressor, release: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Makeup Gain */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Makeup Gain</span>
                    <span className="font-mono text-cyan-300">+{effects.compressor.makeupGain} dB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="18"
                    step="0.5"
                    value={effects.compressor.makeupGain}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        compressor: { ...effects.compressor, makeupGain: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Limiter */}
          {activeTab === 'limiter' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.limiter.enabled}
                      onChange={(e) =>
                        onChangeEffects({
                          ...effects,
                          limiter: { ...effects.limiter, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">Enable Peak Limiter</span>
                  </label>

                  <button
                    onClick={handleResetLimiter}
                    className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
                    title="Reset Limiter to default"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    <span>Reset Limiter</span>
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1 shrink-0">Presets:</span>
                  {Object.keys(LIMITER_PRESETS).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleApplyLimiterPreset(preset)}
                      className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all shrink-0"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg text-cyan-300 text-[11px]">
                Implemented using a precision high-ratio DynamicsCompressorNode (20:1, 1ms fast attack) coupled with output ceiling headroom control to prevent inter-sample clipping on speakers and headphones.
              </div>

              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {/* Ceiling dB */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Ceiling</span>
                    <span className="font-mono text-cyan-300">{effects.limiter.ceiling} dBFS</span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="0"
                    step="0.1"
                    value={effects.limiter.ceiling}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        limiter: { ...effects.limiter, ceiling: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Release */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Release Time</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(effects.limiter.release * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={effects.limiter.release}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        limiter: { ...effects.limiter, release: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Noise Gate */}
          {activeTab === 'gate' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effects.noiseGate.enabled}
                      onChange={(e) =>
                        onChangeEffects({
                          ...effects,
                          noiseGate: { ...effects.noiseGate, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">Enable Noise Gate</span>
                  </label>

                  <button
                    onClick={handleResetNoiseGate}
                    className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
                    title="Reset Noise Gate to default"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    <span>Reset Gate</span>
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1 shrink-0">Presets:</span>
                  {Object.keys(NOISE_GATE_PRESETS).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleApplyGatePreset(preset)}
                      className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all shrink-0"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {/* Threshold */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Gate Threshold</span>
                    <span className="font-mono text-cyan-300">{effects.noiseGate.threshold} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-80"
                    max="-20"
                    step="1"
                    value={effects.noiseGate.threshold}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        noiseGate: { ...effects.noiseGate, threshold: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Attack */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Attack</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(effects.noiseGate.attack * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.001"
                    max="0.05"
                    step="0.002"
                    value={effects.noiseGate.attack}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        noiseGate: { ...effects.noiseGate, attack: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>

                {/* Release */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Release</span>
                    <span className="font-mono text-cyan-300">
                      {Math.round(effects.noiseGate.release * 1000)} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={effects.noiseGate.release}
                    onChange={(e) =>
                      onChangeEffects({
                        ...effects,
                        noiseGate: { ...effects.noiseGate, release: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Normalize */}
          {activeTab === 'normalize' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Normalization Mode</span>
                  <button
                    onClick={handleResetNormalize}
                    className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700 active:scale-95 transition-all flex items-center gap-1"
                    title="Reset Normalize settings to default"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-400" />
                    <span>Reset Normalize</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNormMode('peak')}
                    className={`min-h-[44px] px-3 py-2 rounded-lg font-medium border transition-colors ${
                      normMode === 'peak'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Peak (dBFS)
                  </button>
                  <button
                    onClick={() => setNormMode('lufs')}
                    className={`min-h-[44px] px-3 py-2 rounded-lg font-medium border transition-colors ${
                      normMode === 'lufs'
                        ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Loudness (LUFS)
                  </button>
                </div>

                {normMode === 'peak' ? (
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Target Peak Level</span>
                      <span className="font-mono text-cyan-300">{peakTargetDb} dBFS</span>
                    </div>
                    <input
                      type="range"
                      min="-6"
                      max="0"
                      step="0.1"
                      value={peakTargetDb}
                      onChange={(e) => setPeakTargetDb(parseFloat(e.target.value))}
                      className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Target Integrated Loudness</span>
                      <span className="font-mono text-cyan-300">{lufsTarget} LUFS</span>
                    </div>
                    <input
                      type="range"
                      min="-24"
                      max="-8"
                      step="1"
                      value={lufsTarget}
                      onChange={(e) => setLufsTarget(parseInt(e.target.value))}
                      className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Default -14 LUFS is the industry standard for streaming (Spotify, YouTube, Apple Music).</p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={handleRunNormalization}
                    disabled={!selectedClip}
                    className="w-full min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Apply Normalization to Selected Clip
                  </button>
                </div>

                {normResultText && (
                  <div className="p-2.5 bg-cyan-950/40 border border-cyan-800/60 rounded-lg text-cyan-300 text-[11px] font-mono">
                    {normResultText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
