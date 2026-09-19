import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  FoldHorizontal,
  MoveHorizontal,
} from 'lucide-react';
import { GapInfo } from '../audio/gapManager';

interface TimelineNavZoomBarProps {
  currentTime: number;
  totalDuration: number;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onZoomFit: () => void;
  onSeek: (time: number) => void;
  onStepTime: (deltaSeconds: number) => void;
  gapInfo: GapInfo;
  onCloseGaps: () => void;
  hasClips: boolean;
}

export const TimelineNavZoomBar: React.FC<TimelineNavZoomBarProps> = ({
  currentTime,
  totalDuration,
  zoom,
  onZoomChange,
  onZoomFit,
  onSeek,
  onStepTime,
  gapInfo,
  onCloseGaps,
  hasClips,
}) => {
  const maxTime = Math.max(1, totalDuration);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-slate-900/95 border-y border-slate-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-20 select-none backdrop-blur-sm">
      {/* SECTION 1: Aghe / Peeche (Timeline Pan & Scrub Slider) */}
      <div className="flex-1 min-w-[240px] flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-xl border border-slate-800/80 shadow-inner">
        {/* Jump to start */}
        <button
          onClick={() => onSeek(0)}
          className="min-h-[36px] min-w-[36px] p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center justify-center shrink-0"
          title="Jump to Start (0:00)"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Step backward 5s */}
        <button
          onClick={() => onStepTime(-5)}
          className="min-h-[36px] px-2 py-1 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center gap-0.5 text-xs font-mono font-medium shrink-0"
          title="Peeche 5s (-5 sec)"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>-5s</span>
        </button>

        {/* Label & Scrub Slider */}
        <div className="flex-1 flex flex-col justify-center px-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-0.5">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <MoveHorizontal className="w-3 h-3" />
              Aghe / Peeche
            </span>
            <span className="font-mono text-slate-300">
              {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={maxTime}
            step="0.05"
            value={Math.min(currentTime, maxTime)}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 active:scale-[1.01] transition-transform"
            title="Aghe / Peeche slide karein"
          />
        </div>

        {/* Step forward 5s */}
        <button
          onClick={() => onStepTime(5)}
          className="min-h-[36px] px-2 py-1 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center gap-0.5 text-xs font-mono font-medium shrink-0"
          title="Aghe 5s (+5 sec)"
        >
          <span>+5s</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Jump to end */}
        <button
          onClick={() => onSeek(maxTime)}
          className="min-h-[36px] min-w-[36px] p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center justify-center shrink-0"
          title="Jump to End"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* SECTION 2: Zoom Slider & Fit */}
      <div className="flex items-center gap-1.5 bg-slate-950/70 px-2.5 py-1 rounded-xl border border-slate-800/80 shadow-inner">
        <button
          onClick={() => onZoomChange(Math.max(10, Math.round(zoom / 1.3)))}
          className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center justify-center"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="flex flex-col justify-center w-24 sm:w-32 px-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-0.5">
            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
              <ZoomIn className="w-3 h-3" />
              Zoom
            </span>
            <span className="font-mono text-slate-300 text-[10px]">
              {Math.round((zoom / 50) * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-colors"
            title="Zoom slider"
          />
        </div>

        <button
          onClick={() => onZoomChange(Math.min(300, Math.round(zoom * 1.3)))}
          className="min-h-[36px] min-w-[36px] p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 transition-all flex items-center justify-center"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Fit to screen button */}
        <button
          onClick={onZoomFit}
          className="min-h-[36px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 rounded-lg border border-slate-700/80 active:scale-95 transition-all flex items-center gap-1 text-[11px] font-medium"
          title="Fit entire project to screen width"
        >
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Fit</span>
        </button>
      </div>

      {/* SECTION 3: 1-Click Close Gaps (Remove Deleted Spaces) */}
      <div className="flex items-center gap-1">
        <button
          onClick={onCloseGaps}
          disabled={!hasClips || gapInfo.gapsCount === 0}
          className={`min-h-[38px] px-3 py-1 rounded-xl flex items-center gap-1.5 text-xs font-semibold border transition-all active:scale-95 shadow-sm ${
            gapInfo.gapsCount > 0
              ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/60 text-amber-200 animate-pulse'
              : 'bg-slate-800/60 border-slate-700/60 text-slate-400 disabled:opacity-40 disabled:pointer-events-none'
          }`}
          title="Deleted hisson ki khali jagah ko 1 click mein khatam karein (Close Gaps)"
        >
          <FoldHorizontal className={`w-4 h-4 ${gapInfo.gapsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="font-medium">Close Gaps</span>
          {gapInfo.gapsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
              {gapInfo.gapsCount} {gapInfo.gapsCount === 1 ? 'Space' : 'Spaces'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
