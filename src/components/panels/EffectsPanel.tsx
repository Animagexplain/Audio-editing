import React, { useState } from 'react';
import { EffectsConfig, EQSettings, CompressorSettings, LimiterSettings, NoiseGateSettings, AudioClip } from '../../types';
import { EQ_PRESETS } from '../../audio/EffectsGraph';
import { calculatePeakNormalization, calculateLoudnessNormalization, applyGainToAudioBuffer } from '../../audio/Normalization';
import { AudioEngine } from '../../audio/AudioEngine';
import { Activity, Sliders, ShieldAlert, Disc, Check, Sparkles } from 'lucide-react';

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
        <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto scrollbar-none px-2 py-1.5 gap-1">
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
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
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

                {/* Presets */}
                <div className="flex items-center gap-1">
                  {['Flat', 'Voice Clear', 'Bass Boost'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleApplyPreset(preset)}
                      className="min-h-[38px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 active:scale-95 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Low Cut Switch */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                <div>
                  <span className="font-medium text-slate-200">80Hz Low Cut Filter</span>
                  <p className="text-[10px] text-slate-400">Cuts sub-bass rumble, plosives & mic handling noise</p>
                </div>
                <button
                  onClick={() =>
                    onChangeEffects({
                      ...effects,
                      eq: { ...effects.eq, lowCut: !effects.eq.lowCut },
                    })
                  }
                  className={`min-h-[44px] px-3 py-1 rounded font-bold border ${
                    effects.eq.lowCut
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {effects.eq.lowCut ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* 5 Bands Frequencies */}
              <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {[
                  { key: 'band1', freq: '100 Hz (Low Shelf)', label: 'Bass' },
                  { key: 'band2', freq: '350 Hz (Peaking)', label: 'Low Mid' },
                  { key: 'band3', freq: '1,000 Hz (Peaking)', label: 'Mid' },
                  { key: 'band4', freq: '3,500 Hz (Peaking)', label: 'Presence' },
                  { key: 'band5', freq: '10,000 Hz (High Shelf)', label: 'Air / High' },
                ].map((band) => {
                  const val = (effects.eq as any)[band.key] || 0;
                  return (
                    <div key={band.key} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-300 font-medium">
                          {band.label} <span className="text-slate-400 text-[11px]">({band.freq})</span>
                        </span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {val > 0 ? `+${val}` : val} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
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
                <span className="font-semibold text-slate-200">Normalization Mode</span>

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
