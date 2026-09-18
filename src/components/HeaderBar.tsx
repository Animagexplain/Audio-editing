import React from 'react';
import { ZoomIn, ZoomOut, Check, Waves } from 'lucide-react';

interface HeaderBarProps {
  currentTime: number;
  totalDuration: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isAutoSaved: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentTime,
  totalDuration,
  zoom,
  onZoomIn,
  onZoomOut,
  isAutoSaved,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between select-none z-30 pt-safe">
      {/* Brand & Auto-save Status */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center">
          <Waves className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100 leading-tight">Audio Editor</h1>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isAutoSaved ? 'bg-emerald-400 shadow-[0_0_4px_#34d399]' : 'bg-amber-400'
              }`}
            />
            <span>{isAutoSaved ? 'Saved to device' : 'Saving...'}</span>
          </div>
        </div>
      </div>

      {/* Timecode Display */}
      <div className="bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1 font-mono text-xs">
        <span className="text-cyan-400 font-bold">{formatTime(currentTime)}</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-400">{formatTime(totalDuration)}</span>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="min-h-[44px] min-w-[44px] p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 flex items-center justify-center transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomIn}
          className="min-h-[44px] min-w-[44px] p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg active:scale-95 flex items-center justify-center transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
