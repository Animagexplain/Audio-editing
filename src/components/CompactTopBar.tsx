import React, { useState } from 'react';
import {
  Waves,
  Play,
  Pause,
  Repeat,
  Undo2,
  Redo2,
  FolderOpen,
  Mic,
  Sliders,
  Activity,
  Download,
  Plus,
  Trash2,
  Volume2,
} from 'lucide-react';
import { Track } from '../types';

interface CompactTopBarProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  onUpdateTrack: (track: Track) => void;
  onAddTrack: () => void;
  onDeleteTrack: (trackId: string) => void;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onImportClick: () => void;
  onOpenRecord: () => void;
  onOpenTools: () => void;
  onOpenEffects: () => void;
  onOpenExport: () => void;
  isAutoSaved: boolean;
}

export const CompactTopBar: React.FC<CompactTopBarProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
  currentTime,
  totalDuration,
  isPlaying,
  onTogglePlay,
  isLooping,
  onToggleLoop,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onImportClick,
  onOpenRecord,
  onOpenTools,
  onOpenEffects,
  onOpenExport,
  isAutoSaved,
}) => {
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 px-2 py-1 flex items-center justify-between select-none z-30 h-10 shrink-0 gap-1.5 backdrop-blur-sm">
      {/* LEFT SECTION: Brand & Tracks Management */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Compact Logo */}
        <div className="flex items-center gap-1.5 pr-1 border-r border-slate-800">
          <div className="w-6 h-6 rounded bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="hidden md:inline text-xs font-bold text-slate-100 whitespace-nowrap">
            Audio Editor
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isAutoSaved ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            title={isAutoSaved ? 'Saved to device' : 'Saving...'}
          />
        </div>

        {/* Track Chips */}
        <div className="flex items-center gap-1">
          {tracks.map((t, idx) => {
            const isSelected = t.id === selectedTrackId;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTrack(t.id)}
                className={`h-7 px-2 rounded flex items-center gap-1 text-[11px] font-medium border transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-500/80 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={`Track ${idx + 1}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="whitespace-nowrap">T{idx + 1}</span>
                {t.isMuted && <span className="text-[9px] text-red-400 font-bold">M</span>}
                {t.isSoloed && <span className="text-[9px] text-amber-400 font-bold">S</span>}
              </button>
            );
          })}

          {tracks.length < 3 && (
            <button
              onClick={onAddTrack}
              className="h-7 w-7 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs hover:bg-cyan-600/30 active:scale-95 transition-all"
              title="Add Track"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          {tracks.length > 1 && (
            <button
              onClick={() => onDeleteTrack(selectedTrack.id)}
              className="h-7 w-7 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 flex items-center justify-center text-xs active:scale-95 transition-all"
              title="Delete Active Track"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selected Track Quick Mute / Solo / Vol */}
        {selectedTrack && (
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800/80">
            <button
              onClick={() =>
                onUpdateTrack({
                  ...selectedTrack,
                  isMuted: !selectedTrack.isMuted,
                })
              }
              className={`h-7 px-1.5 rounded text-[10px] font-bold border transition-colors ${
                selectedTrack.isMuted
                  ? 'bg-red-500/30 border-red-500 text-red-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Mute Track"
            >
              M
            </button>

            <button
              onClick={() =>
                onUpdateTrack({
                  ...selectedTrack,
                  isSoloed: !selectedTrack.isSoloed,
                })
              }
              className={`h-7 px-1.5 rounded text-[10px] font-bold border transition-colors ${
                selectedTrack.isSoloed
                  ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Solo Track"
            >
              S
            </button>

            {/* Volume toggle slider */}
            <div className="relative">
              <button
                onClick={() => setShowVolumePopover(!showVolumePopover)}
                className="h-7 px-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-400 flex items-center gap-1 text-[10px]"
                title="Track Volume"
              >
                <Volume2 className="w-3 h-3" />
                <span className="font-mono text-[9px]">{Math.round(selectedTrack.volume * 100)}%</span>
              </button>

              {showVolumePopover && (
                <div className="absolute top-9 left-0 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl z-50 flex items-center gap-2 w-44">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={selectedTrack.volume}
                    onChange={(e) =>
                      onUpdateTrack({
                        ...selectedTrack,
                        volume: parseFloat(e.target.value),
                      })
                    }
                    className="flex-1 h-1.5 accent-cyan-400 bg-slate-700 rounded cursor-pointer"
                  />
                  <button
                    onClick={() => setShowVolumePopover(false)}
                    className="text-[10px] text-slate-400 hover:text-white px-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CENTER SECTION: Transport & Timecode */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className={`h-7 px-3 rounded-lg flex items-center justify-center font-bold text-xs gap-1 shadow transition-transform active:scale-95 ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-slate-950" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-slate-950 ml-0.5" />
          )}
          <span className="text-[10px] font-semibold uppercase">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onToggleLoop}
          className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${
            isLooping
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Loop Playback"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>

        {/* Timecode Pill */}
        <div className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono text-[11px]">
          <span className="text-cyan-400 font-bold">{formatTime(currentTime)}</span>
          <span className="text-slate-600 text-[10px]">/</span>
          <span className="text-slate-400">{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* RIGHT SECTION: Actions & Modals */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="h-7 w-7 rounded flex items-center justify-center text-slate-300 disabled:text-slate-600 hover:bg-slate-800 active:scale-95 transition-colors"
          title="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="h-7 w-7 rounded flex items-center justify-center text-slate-300 disabled:text-slate-600 hover:bg-slate-800 active:scale-95 transition-colors"
          title="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

        {/* Import */}
        <button
          onClick={onImportClick}
          className="h-7 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-sky-500/30 flex items-center gap-1 text-[11px] font-medium active:scale-95 transition-colors"
          title="Import Audio"
        >
          <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Record */}
        <button
          onClick={onOpenRecord}
          className="h-7 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-red-300 border border-red-500/30 flex items-center gap-1 text-[11px] font-medium active:scale-95 transition-colors"
          title="Record Microphone"
        >
          <Mic className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden sm:inline">Record</span>
        </button>

        {/* Tools */}
        <button
          onClick={onOpenTools}
          className="h-7 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1 text-[11px] font-medium active:scale-95 transition-colors"
          title="Tools (Speed, Pitch, Fade, Silence)"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden lg:inline">Tools</span>
        </button>

        {/* Effects */}
        <button
          onClick={onOpenEffects}
          className="h-7 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 text-[11px] font-medium active:scale-95 transition-colors"
          title="Effects (EQ, Reverb, Compressor)"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">FX</span>
        </button>

        {/* Export */}
        <button
          onClick={onOpenExport}
          className="h-7 px-2.5 rounded bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 flex items-center gap-1 text-[11px] font-semibold active:scale-95 transition-colors"
          title="Export Project"
        >
          <Download className="w-3.5 h-3.5 text-purple-400" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
