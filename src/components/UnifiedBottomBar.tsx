import React from 'react';
import {
  Scissors,
  Crop,
  Trash2,
  FoldHorizontal,
  Copy,
  ClipboardPaste,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoveHorizontal,
} from 'lucide-react';
import { GapInfo } from '../audio/gapManager';

interface UnifiedBottomBarProps {
  // Editing Props
  onSplit: () => void;
  onTrim: () => void;
  onDelete: () => void;
  onRippleDelete: () => void;
  onCloseGaps: () => void;
  gapInfo: GapInfo;
  onCopy: () => void;
  canPaste: boolean;
  onPaste: () => void;
  hasSelection: boolean;
  hasClips: boolean;

  // Navigation & Zoom Props
  currentTime: number;
  totalDuration: number;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onZoomFit: () => void;
  onSeek: (time: number) => void;
  onStepTime: (deltaSeconds: number) => void;
}

export const UnifiedBottomBar: React.FC<UnifiedBottomBarProps> = ({
  onSplit,
  onTrim,
  onDelete,
  onRippleDelete,
  onCloseGaps,
  gapInfo,
  onCopy,
  canPaste,
  onPaste,
  hasSelection,
  hasClips,
  currentTime,
  totalDuration,
  zoom,
  onZoomChange,
  onZoomFit,
  onSeek,
  onStepTime,
}) => {
  const maxTime = Math.max(1, totalDuration);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div
      className="bg-slate-900/95 border-t border-slate-800 px-3 py-1 flex items-center justify-between gap-1.5 select-none z-30 min-h-[44px] shrink-0 backdrop-blur-sm overflow-x-auto scrollbar-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* SECTION 1: Editing Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Split */}
        <button
          onClick={onSplit}
          disabled={!hasClips}
          className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:text-slate-600 disabled:opacity-50 hover:bg-slate-800 active:scale-95 flex items-center gap-1 text-[11px] font-medium transition-all"
          title="Split clip at playhead"
        >
          <Scissors className="w-3.5 h-3.5 text-cyan-400" />
          <span>Split</span>
        </button>

        {/* Trim */}
        <button
          onClick={onTrim}
          disabled={!hasSelection}
          className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:text-slate-600 disabled:opacity-50 hover:bg-slate-800 active:scale-95 flex items-center gap-1 text-[11px] font-medium transition-all"
          title="Trim (keep only selected region)"
        >
          <Crop className="w-3.5 h-3.5 text-cyan-400" />
          <span>Trim</span>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={!hasSelection && !hasClips}
          className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 disabled:text-slate-600 disabled:opacity-50 hover:bg-red-500/20 hover:text-red-300 active:scale-95 flex items-center gap-1 text-[11px] font-medium transition-all"
          title="Delete selected region or clip"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span>Del</span>
        </button>

        {/* Ripple Delete (Deletes and automatically closes space) */}
        <button
          onClick={onRippleDelete}
          disabled={!hasSelection && !hasClips}
          className="h-8 px-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 disabled:text-slate-600 disabled:opacity-50 hover:bg-amber-500/25 active:scale-95 flex items-center gap-1 text-[11px] font-medium transition-all"
          title="Ripple Delete: Deletes selection and closes empty space automatically"
        >
          <FoldHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span className="whitespace-nowrap">Ripple Del</span>
        </button>

        {/* 1-Click Close Gaps (Remove all empty spaces) */}
        <button
          onClick={onCloseGaps}
          disabled={!hasClips || gapInfo.gapsCount === 0}
          className={`h-8 px-2.5 rounded-lg active:scale-95 flex items-center gap-1.5 text-[11px] font-medium transition-all ${
            gapInfo.gapsCount > 0
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/30 animate-pulse'
              : 'bg-slate-950 border border-slate-800 text-slate-600 disabled:opacity-40'
          }`}
          title="1 Click mein khali jagah (empty space) khatam karein"
        >
          <FoldHorizontal className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Close Gaps</span>
          {gapInfo.gapsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-bold">
              {gapInfo.gapsCount}
            </span>
          )}
        </button>

        {/* Copy & Paste */}
        <button
          onClick={onCopy}
          disabled={!hasSelection && !hasClips}
          className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:text-slate-600 disabled:opacity-50 hover:bg-slate-800 active:scale-95 flex items-center gap-1 text-[11px] transition-all"
          title="Copy"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onPaste}
          disabled={!canPaste}
          className="h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:text-slate-600 disabled:opacity-50 hover:bg-slate-800 active:scale-95 flex items-center gap-1 text-[11px] transition-all"
          title="Paste"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
        </button>
      </div>

      <div className="w-[1px] h-5 bg-slate-800 shrink-0" />

      {/* SECTION 2: Aghe / Peeche Navigation Slider */}
      <div className="flex-1 min-w-[200px] max-w-[340px] flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
        <button
          onClick={() => onSeek(0)}
          className="h-7 w-6 text-slate-400 hover:text-white rounded active:scale-95 flex items-center justify-center shrink-0"
          title="Jump to Start"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onStepTime(-5)}
          className="h-7 px-1 text-slate-300 hover:text-cyan-300 rounded active:scale-95 flex items-center text-[10px] font-mono shrink-0"
          title="Step back 5 seconds (-5s)"
        >
          <ChevronLeft className="w-3 h-3" />
          <span>-5s</span>
        </button>

        {/* Scrubber slider */}
        <div className="flex-1 flex flex-col justify-center px-1">
          <input
            type="range"
            min="0"
            max={maxTime}
            step="0.05"
            value={Math.min(currentTime, maxTime)}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
            title="Aghe / Peeche timeline slider"
          />
        </div>

        <button
          onClick={() => onStepTime(5)}
          className="h-7 px-1 text-slate-300 hover:text-cyan-300 rounded active:scale-95 flex items-center text-[10px] font-mono shrink-0"
          title="Step forward 5 seconds (+5s)"
        >
          <span>+5s</span>
          <ChevronRight className="w-3 h-3" />
        </button>

        <button
          onClick={() => onSeek(totalDuration)}
          className="h-7 w-6 text-slate-400 hover:text-white rounded active:scale-95 flex items-center justify-center shrink-0"
          title="Jump to End"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-[1px] h-5 bg-slate-800 shrink-0" />

      {/* SECTION 3: Timeline Zoom Slider */}
      <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
        <button
          onClick={() => onZoomChange(Math.max(10, zoom - 15))}
          className="h-7 w-6 text-slate-400 hover:text-cyan-300 rounded active:scale-95 flex items-center justify-center text-xs font-bold shrink-0"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <input
          type="range"
          min="10"
          max="300"
          step="5"
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="w-16 h-1.5 accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer"
          title="Zoom Slider"
        />

        <button
          onClick={() => onZoomChange(Math.min(300, zoom + 15))}
          className="h-7 w-6 text-slate-400 hover:text-cyan-300 rounded active:scale-95 flex items-center justify-center text-xs font-bold shrink-0"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onZoomFit}
          className="h-7 px-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-cyan-300 flex items-center gap-0.5 text-[10px] font-semibold active:scale-95 transition-all shrink-0 ml-0.5"
          title="Fit whole project to screen"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
};
