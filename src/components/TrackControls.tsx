import React from 'react';
import { Track } from '../types';
import { Volume2, VolumeX, MoveHorizontal, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface TrackControlsProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (id: string) => void;
  onUpdateTrack: (track: Track) => void;
  onAddTrack: () => void;
  onDeleteTrack: (id: string) => void;
}

export const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
}) => {
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0];

  if (!selectedTrack) return null;

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
      {/* Track Tabs & Add Button */}
      <div className="flex items-center justify-between gap-1 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {tracks.map((t, idx) => {
            const isSelected = t.id === selectedTrackId;
            return (
              <button
                key={t.id}
                onClick={() => onSelectTrack(t.id)}
                className={`min-h-[38px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-500/70 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="truncate max-w-[80px]">Track {idx + 1}</span>
                {t.isMuted && <span className="text-[10px] text-red-400 font-bold">M</span>}
                {t.isSoloed && <span className="text-[10px] text-amber-400 font-bold">S</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {tracks.length < 3 && (
            <button
              onClick={onAddTrack}
              className="min-h-[38px] min-w-[38px] px-2 py-1 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center gap-1 text-xs font-medium hover:bg-cyan-600/30 active:scale-95 transition-all"
              title="Add Track (up to 3)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline text-[11px]">Track</span>
            </button>
          )}

          {tracks.length > 1 && (
            <button
              onClick={() => onDeleteTrack(selectedTrack.id)}
              className="min-h-[38px] min-w-[38px] p-1.5 text-slate-400 hover:text-red-400 rounded-lg active:scale-95 transition-colors flex items-center justify-center"
              title="Delete Track"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected Track Detailed Controls: Volume, Mute, Solo, Time Shift */}
      <div className="flex flex-wrap items-center justify-between md:justify-end gap-1.5 pt-1 md:pt-0 border-t md:border-t-0 border-slate-800/60 text-xs">
        {/* Mute & Solo Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              onUpdateTrack({
                ...selectedTrack,
                isMuted: !selectedTrack.isMuted,
              })
            }
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded font-bold text-[11px] border transition-colors ${
              selectedTrack.isMuted
                ? 'bg-red-500/30 border-red-500 text-red-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            MUTE
          </button>

          <button
            onClick={() =>
              onUpdateTrack({
                ...selectedTrack,
                isSoloed: !selectedTrack.isSoloed,
              })
            }
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded font-bold text-[11px] border transition-colors ${
              selectedTrack.isSoloed
                ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            SOLO
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex-1 md:flex-initial min-w-[120px] max-w-[170px] flex items-center gap-1.5 px-2 py-1 bg-slate-950/60 rounded border border-slate-800">
          <Volume2 className="w-3 h-3 text-slate-400 shrink-0" />
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
          <span className="text-[10px] font-mono text-slate-300 w-8 text-right shrink-0">
            {Math.round(selectedTrack.volume * 100)}%
          </span>
        </div>

        {/* Time Move / Nudge in time */}
        <div className="flex items-center gap-0.5 bg-slate-950/60 rounded border border-slate-800 px-1.5 py-0.5">
          <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mr-0.5">
            <MoveHorizontal className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Shift:</span>
          </span>
          <button
            onClick={() =>
              onUpdateTrack({
                ...selectedTrack,
                timeOffset: Math.max(0, Math.round((selectedTrack.timeOffset - 0.1) * 10) / 10),
              })
            }
            className="min-h-[36px] min-w-[30px] flex items-center justify-center p-1 text-slate-300 hover:bg-slate-800 rounded active:scale-95"
            title="Nudge 0.1s left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-cyan-300 min-w-[32px] text-center font-bold">
            {selectedTrack.timeOffset.toFixed(1)}s
          </span>
          <button
            onClick={() =>
              onUpdateTrack({
                ...selectedTrack,
                timeOffset: Math.round((selectedTrack.timeOffset + 0.1) * 10) / 10,
              })
            }
            className="min-h-[36px] min-w-[30px] flex items-center justify-center p-1 text-slate-300 hover:bg-slate-800 rounded active:scale-95"
            title="Nudge 0.1s right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
