import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Track, AudioClip, TimelineSelection, SilenceRegion, PeakData } from '../types';
import { drawWaveformToCanvas } from '../audio/PeakExtractor';
import { AudioEngine } from '../audio/AudioEngine';

interface WaveformTimelineProps {
  tracks: Track[];
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  audioEngine: AudioEngine;
  currentTime: number;
  selection: TimelineSelection | null;
  onSelectionChange: (selection: TimelineSelection | null) => void;
  onSeek: (time: number) => void;
  zoom: number; // Pixels per second
  onZoomChange: (newZoom: number) => void;
  silencePreviews: SilenceRegion[];
  maxDuration: number;
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  audioEngine,
  currentTime,
  selection,
  onSelectionChange,
  onSeek,
  zoom,
  onZoomChange,
  silencePreviews,
  maxDuration,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoom);

  // Dragging selection handles state
  const [isDraggingLeftHandle, setIsDraggingLeftHandle] = useState(false);
  const [isDraggingRightHandle, setIsDraggingRightHandle] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  const timelineDuration = Math.max(10, maxDuration + 3);
  const totalTimelineWidth = Math.max(340, Math.ceil(timelineDuration * zoom));

  // Handle pinch to zoom on touch devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      initialZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const newZoom = Math.max(10, Math.min(300, initialZoomRef.current * ratio));
      onZoomChange(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  // Convert clientX to timeline seconds
  const clientXToSeconds = useCallback(
    (clientX: number): number => {
      if (!scrollRef.current) return 0;
      const rect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.min(timelineDuration, offsetX / zoom));
    },
    [zoom, timelineDuration]
  );

  // Tap on ruler or track background to seek or start drag selection
  const handleTimelinePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.selection-handle')) {
      return; // Handled by selection handle listeners
    }

    const clickTime = clientXToSeconds(e.clientX);
    onSeek(clickTime);

    // Click to start drag selection if dragging
    setDragStartX(e.clientX);
  };

  const handleTimelinePointerMove = (e: React.PointerEvent) => {
    if (dragStartX !== null && Math.abs(e.clientX - dragStartX) > 8) {
      const startTime = clientXToSeconds(Math.min(dragStartX, e.clientX));
      const endTime = clientXToSeconds(Math.max(dragStartX, e.clientX));
      onSelectionChange({
        trackId: selectedTrackId,
        startTime,
        endTime,
      });
    }
  };

  const handleTimelinePointerUp = () => {
    setDragStartX(null);
  };

  // Selection Handle Dragging
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingLeftHandle && !isDraggingRightHandle) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const time = clientXToSeconds(clientX);

      if (isDraggingLeftHandle && selection) {
        const newStart = Math.min(time, selection.endTime - 0.05);
        onSelectionChange({
          ...selection,
          startTime: Math.max(0, newStart),
        });
      } else if (isDraggingRightHandle && selection) {
        const newEnd = Math.max(time, selection.startTime + 0.05);
        onSelectionChange({
          ...selection,
          endTime: Math.min(timelineDuration, newEnd),
        });
      }
    };

    const handleUp = () => {
      setIsDraggingLeftHandle(false);
      setIsDraggingRightHandle(false);
    };

    if (isDraggingLeftHandle || isDraggingRightHandle) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingLeftHandle, isDraggingRightHandle, selection, clientXToSeconds, timelineDuration, onSelectionChange]);

  // Keep playhead within view when seeking or playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playheadPx = currentTime * zoom;
    const scrollLeft = el.scrollLeft;
    const viewWidth = el.clientWidth;

    if (playheadPx < scrollLeft || playheadPx > scrollLeft + viewWidth - 30) {
      el.scrollLeft = Math.max(0, playheadPx - viewWidth / 3);
    }
  }, [currentTime, zoom]);

  // Format ruler time: mm:ss or mm:ss.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const playheadPixelX = currentTime * zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex flex-col bg-slate-950 overflow-hidden select-none touch-pan-x"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Scrollable Timeline Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative scrollbar-none"
        onPointerDown={handleTimelinePointerDown}
        onPointerMove={handleTimelinePointerMove}
        onPointerUp={handleTimelinePointerUp}
      >
        <div
          className="relative min-h-full flex flex-col"
          style={{ width: `${totalTimelineWidth}px` }}
        >
          {/* Time Ruler */}
          <div className="h-7 bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-20 flex items-end">
            {Array.from({ length: Math.ceil(timelineDuration / 2) + 1 }).map((_, i) => {
              const sec = i * 2;
              const leftPx = sec * zoom;
              return (
                <div
                  key={sec}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: `${leftPx}px` }}
                >
                  <span className="text-[10px] font-mono text-slate-400 font-medium px-1 select-none">
                    {formatTime(sec)}
                  </span>
                  <div className="w-[1px] h-2 bg-slate-700" />
                </div>
              );
            })}
          </div>

          {/* Tracks Lanes Container */}
          <div className="flex-1 flex flex-col divide-y divide-slate-800/60 relative pb-12">
            {tracks.map((track, trackIndex) => {
              const isSelected = track.id === selectedTrackId;
              return (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  className={`relative h-28 flex items-center transition-colors ${
                    isSelected ? 'bg-slate-900/40' : 'bg-slate-950/40'
                  }`}
                >
                  {/* Track Label Badge */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur border border-slate-700/60 shadow text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="text-slate-200 font-medium text-[11px] truncate max-w-[80px]">
                      {track.name}
                    </span>
                    {track.timeOffset !== 0 && (
                      <span className="text-[10px] text-cyan-400 font-mono">
                        +{track.timeOffset.toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {/* Audio Clips inside this track */}
                  {track.clips.map((clip) => (
                    <ClipWaveformView
                      key={clip.id}
                      clip={clip}
                      track={track}
                      audioEngine={audioEngine}
                      zoom={zoom}
                      isSelectedTrack={isSelected}
                      selection={selection}
                      onSelectClip={() => {
                        onSelectTrack(track.id);
                        onSelectionChange({
                          trackId: track.id,
                          clipId: clip.id,
                          startTime: clip.startTime + track.timeOffset,
                          endTime: clip.startTime + track.timeOffset + clip.duration,
                        });
                      }}
                    />
                  ))}

                  {/* Silence Preview Overlays on this Track */}
                  {isSelected && silencePreviews.map((silence, sIdx) => {
                    const left = silence.start * zoom;
                    const width = (silence.end - silence.start) * zoom;
                    return (
                      <div
                        key={sIdx}
                        className="absolute top-0 bottom-0 bg-amber-500/25 border-x border-amber-400/60 pointer-events-none z-10 flex items-center justify-center"
                        style={{ left: `${left}px`, width: `${width}px` }}
                      >
                        <span className="text-[9px] text-amber-300 font-mono bg-amber-950/80 px-1 rounded">
                          Silence
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Selection Highlight & Draggable Handles */}
          {selection && (
            <div
              className="absolute top-7 bottom-0 bg-cyan-500/15 border-x border-cyan-400/80 pointer-events-none z-20"
              style={{
                left: `${selection.startTime * zoom}px`,
                width: `${Math.max(2, (selection.endTime - selection.startTime) * zoom)}px`,
              }}
            >
              {/* Left Handle (At least 44x44px touch area) */}
              <div
                className="selection-handle pointer-events-auto absolute -left-5 top-0 bottom-0 w-10 flex items-center justify-center cursor-ew-resize touch-none active:scale-110 transition-transform"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingLeftHandle(true);
                }}
              >
                <div className="w-2.5 h-10 bg-cyan-400 rounded-full shadow-lg border border-white/60 flex items-center justify-center">
                  <div className="w-0.5 h-4 bg-slate-900 rounded" />
                </div>
              </div>

              {/* Right Handle (At least 44x44px touch area) */}
              <div
                className="selection-handle pointer-events-auto absolute -right-5 top-0 bottom-0 w-10 flex items-center justify-center cursor-ew-resize touch-none active:scale-110 transition-transform"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingRightHandle(true);
                }}
              >
                <div className="w-2.5 h-10 bg-cyan-400 rounded-full shadow-lg border border-white/60 flex items-center justify-center">
                  <div className="w-0.5 h-4 bg-slate-900 rounded" />
                </div>
              </div>
            </div>
          )}

          {/* Playhead Vertical Needle (Fast 60fps translation without canvas repaint) */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] pointer-events-none z-30 transition-none"
            style={{
              transform: `translateX(${playheadPixelX}px)`,
            }}
          >
            {/* Playhead Badge Indicator */}
            <div className="absolute -top-0.5 -left-3 w-6 h-4 bg-red-500 text-white text-[9px] font-mono rounded-b flex items-center justify-center shadow-md">
              ▼
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ClipWaveformViewProps {
  clip: AudioClip;
  track: Track;
  audioEngine: AudioEngine;
  zoom: number;
  isSelectedTrack: boolean;
  selection: TimelineSelection | null;
  onSelectClip: () => void;
}

const ClipWaveformView: React.FC<ClipWaveformViewProps> = React.memo(
  ({ clip, track, audioEngine, zoom, isSelectedTrack, selection, onSelectClip }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const clipLeftPx = (clip.startTime + track.timeOffset) * zoom;
    const clipWidthPx = Math.max(4, Math.ceil(clip.duration * zoom));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = clipWidthPx * dpr;
      canvas.height = 100 * dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      const buffer = audioEngine.getBuffer(clip.bufferId);
      const peaks = audioEngine.getPeaks(clip.bufferId);

      if (buffer && peaks) {
        drawWaveformToCanvas(
          ctx,
          clipWidthPx,
          100,
          peaks,
          buffer.duration,
          clip.offsetInOriginal,
          clip.duration,
          track.color,
          '#38BDF8',
          selection?.startTime !== undefined ? selection.startTime - (clip.startTime + track.timeOffset) : undefined,
          selection?.endTime !== undefined ? selection.endTime - (clip.startTime + track.timeOffset) : undefined
        );
      }
    }, [clip, track.color, track.timeOffset, clipWidthPx, audioEngine, selection]);

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectClip();
        }}
        className="absolute top-1 bottom-1 rounded-md overflow-hidden bg-slate-900/60 border border-slate-700/60 shadow-sm cursor-pointer hover:border-cyan-500/80 transition-colors"
        style={{
          left: `${clipLeftPx}px`,
          width: `${clipWidthPx}px`,
        }}
      >
        {/* Clip Title */}
        <div className="absolute top-1 left-2 z-10 pointer-events-none">
          <span className="text-[10px] text-slate-300/80 font-medium px-1 rounded bg-slate-950/60">
            {clip.name}
          </span>
        </div>

        {/* Waveform Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: `${clipWidthPx}px`, height: '100%' }}
        />
      </div>
    );
  }
);
