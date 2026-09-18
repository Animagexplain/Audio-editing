import React, { useState } from 'react';
import { AudioClip, TimelineSelection, SilenceRegion } from '../../types';
import { Volume2, Sliders, Scissors, ArrowDownToDot, Gauge, Sparkles, Check } from 'lucide-react';
import { detectSilence, removeSilencesFromClip } from '../../audio/SilenceDetector';
import { processTimeStretch } from '../../audio/TimeStretch';
import { AudioEngine } from '../../audio/AudioEngine';

interface ToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClip: AudioClip | null;
  selection: TimelineSelection | null;
  audioEngine: AudioEngine;
  onUpdateClip: (updatedClip: AudioClip) => void;
  onReplaceClipWithClips: (oldClipId: string, newClips: AudioClip[]) => void;
  onPreviewSilenceChange: (regions: SilenceRegion[]) => void;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  isOpen,
  onClose,
  selectedClip,
  selection,
  audioEngine,
  onUpdateClip,
  onReplaceClipWithClips,
  onPreviewSilenceChange,
}) => {
  // Volume & Gain
  const [gainDb, setGainDb] = useState<number>(0);

  // Fade In / Out
  const [fadeDuration, setFadeDuration] = useState<number>(1.0);

  // Speed and Pitch (independent)
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [isProcessingStretch, setIsProcessingStretch] = useState(false);

  // Silence Remover
  const [silenceThresholdDb, setSilenceThresholdDb] = useState<number>(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState<number>(0.3);
  const [isPreviewingSilence, setIsPreviewingSilence] = useState<boolean>(false);
  const [detectedSilences, setDetectedSilences] = useState<SilenceRegion[]>([]);

  if (!isOpen) return null;

  // Apply Gain to selected clip
  const handleApplyGain = () => {
    if (!selectedClip) return;
    const factor = Math.pow(10, gainDb / 20);
    const newVol = Math.max(0, Math.min(2.0, (selectedClip.volume ?? 1.0) * factor));
    onUpdateClip({
      ...selectedClip,
      volume: newVol,
    });
    setGainDb(0);
  };

  // Apply Fade In on selection or clip start
  const handleApplyFadeIn = () => {
    if (!selectedClip) return;
    const fadeLen = selection
      ? Math.max(0.1, selection.endTime - selection.startTime)
      : fadeDuration;
    onUpdateClip({
      ...selectedClip,
      fadeIn: Math.min(selectedClip.duration, fadeLen),
    });
  };

  // Apply Fade Out on selection or clip end
  const handleApplyFadeOut = () => {
    if (!selectedClip) return;
    const fadeLen = selection
      ? Math.max(0.1, selection.endTime - selection.startTime)
      : fadeDuration;
    onUpdateClip({
      ...selectedClip,
      fadeOut: Math.min(selectedClip.duration, fadeLen),
    });
  };

  // Apply Speed and Pitch shift
  const handleApplySpeedPitch = async () => {
    if (!selectedClip) return;
    const buffer = audioEngine.getBuffer(selectedClip.bufferId);
    if (!buffer) return;

    setIsProcessingStretch(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newBuffer = await processTimeStretch(audioCtx, buffer, speed, pitchSemitones);
      const newBufferId = `buf_stretched_${Date.now()}`;
      audioEngine.registerBuffer(newBufferId, newBuffer);

      // Adjust clip duration based on speed
      const newDuration = selectedClip.duration / speed;
      onUpdateClip({
        ...selectedClip,
        bufferId: newBufferId,
        duration: newDuration,
        speed: 1.0,
        pitch: 0,
      });

      setSpeed(1.0);
      setPitchSemitones(0);
    } catch (e: any) {
      alert(`Time stretch error: ${e.message}`);
    } finally {
      setIsProcessingStretch(false);
    }
  };

  // Detect and preview silence
  const handleTogglePreviewSilence = () => {
    if (!selectedClip) return;
    const buffer = audioEngine.getBuffer(selectedClip.bufferId);
    if (!buffer) return;

    if (isPreviewingSilence) {
      setIsPreviewingSilence(false);
      setDetectedSilences([]);
      onPreviewSilenceChange([]);
      return;
    }

    const silences = detectSilence(
      buffer,
      silenceThresholdDb,
      minSilenceDuration,
      selectedClip.offsetInOriginal,
      selectedClip.offsetInOriginal + selectedClip.duration
    );

    // Map silences relative to timeline
    const timelineSilences = silences.map((s) => ({
      start: selectedClip.startTime + (s.start - selectedClip.offsetInOriginal),
      end: selectedClip.startTime + (s.end - selectedClip.offsetInOriginal),
    }));

    setDetectedSilences(silences);
    setIsPreviewingSilence(true);
    onPreviewSilenceChange(timelineSilences);
  };

  // Remove silences from clip
  const handleRemoveSilences = () => {
    if (!selectedClip) return;
    const buffer = audioEngine.getBuffer(selectedClip.bufferId);
    if (!buffer) return;

    const silences = detectedSilences.length > 0
      ? detectedSilences
      : detectSilence(
          buffer,
          silenceThresholdDb,
          minSilenceDuration,
          selectedClip.offsetInOriginal,
          selectedClip.offsetInOriginal + selectedClip.duration
        );

    if (silences.length === 0) {
      alert('No silences detected matching threshold.');
      return;
    }

    const newClips = removeSilencesFromClip(selectedClip, silences);
    onReplaceClipWithClips(selectedClip.id, newClips);

    setIsPreviewingSilence(false);
    setDetectedSilences([]);
    onPreviewSilenceChange([]);
    onClose();
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
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-sm text-slate-100">Audio Tools</h3>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
          {!selectedClip && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300">
              Please select an audio clip or region on the timeline to apply tools.
            </div>
          )}

          {/* 1. Volume & Gain Adjustment */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                Clip Gain / Volume
              </span>
              <span className="font-mono text-cyan-300 font-bold">
                {gainDb > 0 ? `+${gainDb}` : gainDb} dB
              </span>
            </div>
            <input
              type="range"
              min="-24"
              max="12"
              step="1"
              value={gainDb}
              disabled={!selectedClip}
              onChange={(e) => setGainDb(parseInt(e.target.value))}
              className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
            />
            <div className="flex justify-end pt-1">
              <button
                onClick={handleApplyGain}
                disabled={!selectedClip || gainDb === 0}
                className="min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply Gain
              </button>
            </div>
          </div>

          {/* 2. Fade In / Fade Out */}
          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ArrowDownToDot className="w-4 h-4 text-cyan-400" />
                Fade In & Fade Out
              </span>
              <span className="font-mono text-cyan-300 font-bold">{fadeDuration}s</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.1"
              value={fadeDuration}
              disabled={!selectedClip}
              onChange={(e) => setFadeDuration(parseFloat(e.target.value))}
              className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleApplyFadeIn}
                disabled={!selectedClip}
                className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium rounded-lg active:scale-95 transition-all text-center"
              >
                Apply Fade In
              </button>
              <button
                onClick={handleApplyFadeOut}
                disabled={!selectedClip}
                className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium rounded-lg active:scale-95 transition-all text-center"
              >
                Apply Fade Out
              </button>
            </div>
          </div>

          {/* 3. Speed and Pitch (Independent controls via SoundTouchJS) */}
          <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Speed & Pitch (Independent Time-Stretch)
            </span>

            {/* Speed slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Playback Speed</span>
                <span className="font-mono text-cyan-300">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={speed}
                disabled={!selectedClip || isProcessingStretch}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            {/* Pitch slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Pitch Shift</span>
                <span className="font-mono text-cyan-300">
                  {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} semitones
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={pitchSemitones}
                disabled={!selectedClip || isProcessingStretch}
                onChange={(e) => setPitchSemitones(parseInt(e.target.value))}
                className="w-full h-2 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleApplySpeedPitch}
                disabled={!selectedClip || isProcessingStretch || (speed === 1.0 && pitchSemitones === 0)}
                className="min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-medium rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isProcessingStretch ? 'Processing...' : 'Apply Speed & Pitch'}
              </button>
            </div>
          </div>

          {/* 4. Silence Remover with Preview */}
          <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-cyan-400" />
              Silence Remover
            </span>

            {/* Threshold Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Silence Threshold</span>
                <span className="font-mono text-amber-400">{silenceThresholdDb} dB</span>
              </div>
              <input
                type="range"
                min="-60"
                max="-15"
                step="1"
                value={silenceThresholdDb}
                disabled={!selectedClip}
                onChange={(e) => {
                  setSilenceThresholdDb(parseInt(e.target.value));
                  if (isPreviewingSilence) setIsPreviewingSilence(false);
                }}
                className="w-full h-2 accent-amber-400 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            {/* Minimum duration slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Min Silence Duration</span>
                <span className="font-mono text-amber-400">{minSilenceDuration.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={minSilenceDuration}
                disabled={!selectedClip}
                onChange={(e) => {
                  setMinSilenceDuration(parseFloat(e.target.value));
                  if (isPreviewingSilence) setIsPreviewingSilence(false);
                }}
                className="w-full h-2 accent-amber-400 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleTogglePreviewSilence}
                disabled={!selectedClip}
                className={`min-h-[44px] px-3 py-2 rounded-lg font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                  isPreviewingSilence
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {isPreviewingSilence ? 'Hide Preview' : 'Preview Silences'}
              </button>

              <button
                onClick={handleRemoveSilences}
                disabled={!selectedClip}
                className="min-h-[44px] px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-medium rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Scissors className="w-4 h-4" />
                Remove Silences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
