import React from 'react';
import {
  Play,
  Pause,
  Repeat,
  Scissors,
  Crop,
  Trash2,
  Copy,
  ClipboardPaste,
  Undo2,
  Redo2,
  Sliders,
  Activity,
  Download,
  Mic,
  FolderOpen,
  FoldHorizontal,
} from 'lucide-react';

interface BottomToolbarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onSplit: () => void;
  onTrim: () => void;
  onDelete: () => void;
  onRippleDelete?: () => void;
  onCloseGaps?: () => void;
  gapsCount?: number;
  onCopy: () => void;
  canPaste: boolean;
  onPaste: () => void;
  onOpenTools: () => void;
  onOpenEffects: () => void;
  onOpenExport: () => void;
  onOpenRecord: () => void;
  onImportClick: () => void;
  hasSelection: boolean;
  hasClips: boolean;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  isPlaying,
  onTogglePlay,
  isLooping,
  onToggleLoop,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onSplit,
  onTrim,
  onDelete,
  onRippleDelete,
  onCloseGaps,
  gapsCount = 0,
  onCopy,
  canPaste,
  onPaste,
  onOpenTools,
  onOpenEffects,
  onOpenExport,
  onOpenRecord,
  onImportClick,
  hasSelection,
  hasClips,
}) => {
  return (
    <div className="bg-slate-900 border-t border-slate-800 flex flex-col z-30 select-none pb-safe">
      {/* Row 1: Audio Editing Operations & Quick Transport */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800/60 overflow-x-auto scrollbar-none gap-1">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="min-h-[44px] min-w-[44px] p-2 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center justify-center transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="min-h-[44px] min-w-[44px] p-2 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center justify-center transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="w-[1px] h-6 bg-slate-800 shrink-0" />

        {/* Split at Playhead */}
        <button
          onClick={onSplit}
          disabled={!hasClips}
          className="min-h-[44px] px-2.5 py-1.5 text-slate-200 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center gap-1.5 text-xs font-medium transition-colors"
          title="Split clip at playhead"
        >
          <Scissors className="w-4 h-4 text-cyan-400" />
          <span>Split</span>
        </button>

        {/* Trim Selection */}
        <button
          onClick={onTrim}
          disabled={!hasSelection}
          className="min-h-[44px] px-2.5 py-1.5 text-slate-200 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center gap-1.5 text-xs font-medium transition-colors"
          title="Trim (keep only selection)"
        >
          <Crop className="w-4 h-4 text-cyan-400" />
          <span>Trim</span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={!hasSelection && !hasClips}
          className="min-h-[44px] px-2 py-1.5 text-slate-200 disabled:text-slate-600 hover:bg-red-500/20 hover:text-red-300 rounded-lg active:scale-95 flex items-center gap-1 text-xs font-medium transition-colors"
          title="Delete selected region or clip (leaves empty space)"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>Del</span>
        </button>

        {/* Ripple Delete (Deletes and automatically closes gap) */}
        {onRippleDelete && (
          <button
            onClick={onRippleDelete}
            disabled={!hasSelection && !hasClips}
            className="min-h-[44px] px-2 py-1.5 text-amber-200 disabled:text-slate-600 hover:bg-amber-500/20 rounded-lg active:scale-95 flex items-center gap-1 text-xs font-medium transition-colors"
            title="Ripple Delete: Deletes selection and closes the space automatically"
          >
            <FoldHorizontal className="w-4 h-4 text-amber-400" />
            <span>Ripple Del</span>
          </button>
        )}

        {/* Close Gaps (1-click compact all clips to remove spaces) */}
        {onCloseGaps && (
          <button
            onClick={onCloseGaps}
            disabled={!hasClips || gapsCount === 0}
            className={`min-h-[44px] px-2.5 py-1.5 rounded-lg active:scale-95 flex items-center gap-1 text-xs font-medium transition-all ${
              gapsCount > 0
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-500 hover:bg-slate-800 disabled:opacity-40'
            }`}
            title="1 Click mein khali spaces khatam karein (Close all gaps)"
          >
            <FoldHorizontal className="w-4 h-4" />
            <span>Close Gaps</span>
            {gapsCount > 0 && (
              <span className="ml-0.5 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                {gapsCount}
              </span>
            )}
          </button>
        )}

        <div className="w-[1px] h-6 bg-slate-800 shrink-0" />

        {/* Copy & Paste */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCopy}
            disabled={!hasSelection && !hasClips}
            className="min-h-[44px] px-2 py-1.5 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center gap-1 text-xs transition-colors"
            title="Copy selection"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Copy</span>
          </button>
          <button
            onClick={onPaste}
            disabled={!canPaste}
            className="min-h-[44px] px-2 py-1.5 text-slate-300 disabled:text-slate-600 hover:bg-slate-800 rounded-lg active:scale-95 flex items-center gap-1 text-xs transition-colors"
            title="Paste to playhead"
          >
            <ClipboardPaste className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Paste</span>
          </button>
        </div>
      </div>

      {/* Row 2: Main Bottom Action Bar with Large Touch Targets */}
      <div className="flex items-center justify-around px-2 py-2 gap-1">
        {/* Import Audio */}
        <button
          onClick={onImportClick}
          className="min-h-[48px] min-w-[50px] flex flex-col items-center justify-center p-1 text-slate-300 hover:text-white active:scale-95 transition-all"
        >
          <FolderOpen className="w-5 h-5 text-sky-400" />
          <span className="text-[10px] mt-1 font-medium">Import</span>
        </button>

        {/* Record Mic */}
        <button
          onClick={onOpenRecord}
          className="min-h-[48px] min-w-[50px] flex flex-col items-center justify-center p-1 text-slate-300 hover:text-red-400 active:scale-95 transition-all"
        >
          <Mic className="w-5 h-5 text-red-400" />
          <span className="text-[10px] mt-1 font-medium">Record</span>
        </button>

        {/* Loop Toggle */}
        <button
          onClick={onToggleLoop}
          className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center p-1 rounded-xl transition-all ${
            isLooping
              ? 'text-cyan-300 bg-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Loop playback"
        >
          <Repeat className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Loop</span>
        </button>

        {/* Primary Play/Pause Button (Large prominent 56px touch target) */}
        <button
          onClick={onTogglePlay}
          className="min-h-[52px] min-w-[52px] bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 active:scale-90 transition-transform"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-slate-950" />
          ) : (
            <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
          )}
        </button>

        {/* Audio Tools (Speed, Pitch, Fade, Silence) */}
        <button
          onClick={onOpenTools}
          className="min-h-[48px] min-w-[50px] flex flex-col items-center justify-center p-1 text-slate-300 hover:text-white active:scale-95 transition-all"
        >
          <Sliders className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] mt-1 font-medium">Tools</span>
        </button>

        {/* Master Effects (EQ, Comp, Limiter, Norm) */}
        <button
          onClick={onOpenEffects}
          className="min-h-[48px] min-w-[50px] flex flex-col items-center justify-center p-1 text-slate-300 hover:text-white active:scale-95 transition-all"
        >
          <Activity className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] mt-1 font-medium">Effects</span>
        </button>

        {/* Export Modal */}
        <button
          onClick={onOpenExport}
          className="min-h-[48px] min-w-[50px] flex flex-col items-center justify-center p-1 text-slate-300 hover:text-white active:scale-95 transition-all"
        >
          <Download className="w-5 h-5 text-purple-400" />
          <span className="text-[10px] mt-1 font-medium">Export</span>
        </button>
      </div>
    </div>
  );
};
