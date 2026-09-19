import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Track,
  AudioClip,
  ProjectState,
  EffectsConfig,
  TimelineSelection,
  SilenceRegion,
} from './types';
import { AudioEngine } from './audio/AudioEngine';
import { DEFAULT_EFFECTS } from './audio/EffectsGraph';
import { saveProjectToStorage, loadLatestProjectFromStorage } from './storage/ProjectStorage';
import { HeaderBar } from './components/HeaderBar';
import { WaveformTimeline } from './components/WaveformTimeline';
import { TrackControls } from './components/TrackControls';
import { BottomToolbar } from './components/BottomToolbar';
import { ToolsPanel } from './components/panels/ToolsPanel';
import { EffectsPanel } from './components/panels/EffectsPanel';
import { ExportModal } from './components/panels/ExportModal';
import { RecordModal } from './components/panels/RecordModal';
import { TimelineNavZoomBar } from './components/TimelineNavZoomBar';
import { detectGaps, closeTrackGaps } from './audio/gapManager';
import { Upload, Mic, Music, AlertCircle, CheckCircle2 } from 'lucide-react';

const INITIAL_PROJECT: ProjectState = {
  id: 'proj_default',
  title: 'Untitled Project',
  tracks: [
    {
      id: 'track_1',
      name: 'Track 1',
      color: '#06B6D4',
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      timeOffset: 0,
      clips: [],
    },
  ],
  effects: DEFAULT_EFFECTS,
  duration: 0,
  updatedAt: Date.now(),
};

export const App: React.FC = () => {
  const [audioEngine] = useState<AudioEngine>(() => new AudioEngine());

  // Project & Timeline State
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_1');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [selection, setSelection] = useState<TimelineSelection | null>(null);
  const [zoom, setZoom] = useState<number>(50); // px per second
  const [silencePreviews, setSilencePreviews] = useState<SilenceRegion[]>([]);

  // Undo / Redo History Stack
  const [historyPast, setHistoryPast] = useState<ProjectState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProjectState[]>([]);

  // Clipboard for Copy / Paste
  const [clipboardClip, setClipboardClip] = useState<AudioClip | null>(null);

  // Modals / Panels
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  // Status & Notifications
  const [isAutoSaved, setIsAutoSaved] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<any>(null);

  // Calculate project max duration
  const calculateTotalDuration = useCallback((tracks: Track[]): number => {
    let max = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + track.timeOffset + clip.duration;
        if (end > max) max = end;
      }
    }
    return max;
  }, []);

  const totalDuration = calculateTotalDuration(project.tracks);

  // Helper: Commit a new project state to undo history
  const commitProjectState = useCallback((newProject: ProjectState) => {
    setHistoryPast((prev) => [...prev.slice(-30), project]); // Unlimited undo (up to 30 deep)
    setHistoryFuture([]);
    setProject(newProject);
    setIsAutoSaved(false);
  }, [project]);

  // Sync state with AudioEngine
  useEffect(() => {
    audioEngine.setTracks(project.tracks);
    audioEngine.setEffects(project.effects);
  }, [project.tracks, project.effects, audioEngine]);

  // Setup audio time tracking
  useEffect(() => {
    audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    audioEngine.onStateChange((playing) => {
      setIsPlaying(playing);
    });
  }, [audioEngine]);

  // Restore latest project from IndexedDB on startup
  useEffect(() => {
    const restore = async () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const saved = await loadLatestProjectFromStorage(audioCtx);
        if (saved && saved.project && saved.project.tracks.length > 0) {
          // Register restored buffers into audioEngine
          for (const [id, buf] of saved.buffers.entries()) {
            audioEngine.registerBuffer(id, buf);
          }
          setProject(saved.project);
          if (saved.project.tracks[0]) {
            setSelectedTrackId(saved.project.tracks[0].id);
          }
        }
      } catch (err) {
        console.warn('Initial project restore skipped:', err);
      }
    };
    restore();
  }, [audioEngine]);

  // Periodic Auto-save to IndexedDB
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const buffers = audioEngine.getAllBuffers();
        await saveProjectToStorage(project, buffers);
        setIsAutoSaved(true);
      } catch (err) {
        console.warn('Auto-save error:', err);
      }
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [project, audioEngine]);

  // Handle Play/Pause
  const handleTogglePlay = async () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      await audioEngine.resume();
      if (isLooping && selection && selection.endTime > selection.startTime) {
        audioEngine.setLoop(true, selection.startTime, selection.endTime);
        audioEngine.play(selection.startTime);
      } else {
        audioEngine.setLoop(isLooping, 0, totalDuration);
        audioEngine.play(currentTime);
      }
    }
  };

  // Handle Loop Toggle
  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (selection && selection.endTime > selection.startTime) {
      audioEngine.setLoop(next, selection.startTime, selection.endTime);
    } else {
      audioEngine.setLoop(next, 0, totalDuration);
    }
  };

  // Seek
  const handleSeek = (time: number) => {
    setCurrentTime(time);
    audioEngine.seek(time);
  };

  // Zoom In / Out
  const handleZoomIn = () => setZoom((z) => Math.min(300, Math.round(z * 1.3)));
  const handleZoomOut = () => setZoom((z) => Math.max(10, Math.round(z / 1.3)));

  // Tracks Management
  const handleSelectTrack = (id: string) => {
    setSelectedTrackId(id);
  };

  const handleUpdateTrack = (updatedTrack: Track) => {
    const updatedTracks = project.tracks.map((t) => (t.id === updatedTrack.id ? updatedTrack : t));
    commitProjectState({
      ...project,
      tracks: updatedTracks,
    });
  };

  const handleAddTrack = () => {
    if (project.tracks.length >= 3) return;
    const colors = ['#06B6D4', '#818CF8', '#10B981'];
    const newIdx = project.tracks.length + 1;
    const newTrack: Track = {
      id: `track_${Date.now()}`,
      name: `Track ${newIdx}`,
      color: colors[project.tracks.length % colors.length],
      volume: 1.0,
      isMuted: false,
      isSoloed: false,
      timeOffset: 0,
      clips: [],
    };
    commitProjectState({
      ...project,
      tracks: [...project.tracks, newTrack],
    });
    setSelectedTrackId(newTrack.id);
  };

  const handleDeleteTrack = (trackId: string) => {
    if (project.tracks.length <= 1) return;
    const updatedTracks = project.tracks.filter((t) => t.id !== trackId);
    commitProjectState({
      ...project,
      tracks: updatedTracks,
    });
    setSelectedTrackId(updatedTracks[0].id);
  };

  // File Import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    try {
      const { bufferId, audioBuffer } = await audioEngine.decodeAudioFile(file);

      const targetTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0];
      const newClip: AudioClip = {
        id: `clip_${Date.now()}`,
        trackId: targetTrack.id,
        bufferId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        startTime: currentTime,
        offsetInOriginal: 0,
        duration: audioBuffer.duration,
        volume: 1.0,
        fadeIn: 0,
        fadeOut: 0,
        speed: 1.0,
        pitch: 0,
      };

      const updatedTracks = project.tracks.map((t) =>
        t.id === targetTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
      );

      commitProjectState({
        ...project,
        tracks: updatedTracks,
      });

      // Select new clip range
      setSelection({
        trackId: targetTrack.id,
        clipId: newClip.id,
        startTime: currentTime,
        endTime: currentTime + audioBuffer.duration,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import audio file.');
    } finally {
      e.target.value = '';
    }
  };

  // Recording Complete Handler
  const handleRecordingComplete = (audioBuffer: AudioBuffer, blob: Blob, duration: number) => {
    const bufferId = `buf_rec_${Date.now()}`;
    audioEngine.registerBuffer(bufferId, audioBuffer);

    const targetTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0];
    const newClip: AudioClip = {
      id: `clip_rec_${Date.now()}`,
      trackId: targetTrack.id,
      bufferId,
      name: `Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      startTime: currentTime,
      offsetInOriginal: 0,
      duration: duration,
      volume: 1.0,
      fadeIn: 0,
      fadeOut: 0,
      speed: 1.0,
      pitch: 0,
    };

    const updatedTracks = project.tracks.map((t) =>
      t.id === targetTrack.id ? { ...t, clips: [...t.clips, newClip] } : t
    );

    commitProjectState({
      ...project,
      tracks: updatedTracks,
    });

    setSelection({
      trackId: targetTrack.id,
      clipId: newClip.id,
      startTime: currentTime,
      endTime: currentTime + duration,
    });
  };

  // Find clip at playhead or current selection
  const findActiveClip = (): AudioClip | null => {
    const currentTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) return null;

    if (selection?.clipId) {
      const found = currentTrack.clips.find((c) => c.id === selection.clipId);
      if (found) return found;
    }

    // Otherwise find clip spanning currentTime
    return (
      currentTrack.clips.find(
        (c) =>
          currentTime >= c.startTime + currentTrack.timeOffset &&
          currentTime <= c.startTime + currentTrack.timeOffset + c.duration
      ) ||
      currentTrack.clips[0] ||
      null
    );
  };

  const selectedClip = findActiveClip();

  // EDIT OPERATION 1: SPLIT at playhead
  const handleSplit = () => {
    const currentTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) return;

    // Find clip overlapping currentTime
    const clipToSplit = currentTrack.clips.find(
      (c) =>
        currentTime > c.startTime + currentTrack.timeOffset + 0.05 &&
        currentTime < c.startTime + currentTrack.timeOffset + c.duration - 0.05
    );

    if (!clipToSplit) {
      setErrorMessage('Position playhead within a clip to split.');
      return;
    }

    const splitOffset = currentTime - (clipToSplit.startTime + currentTrack.timeOffset);

    // Left clip
    const leftClip: AudioClip = {
      ...clipToSplit,
      id: `clip_${Date.now()}_a`,
      duration: splitOffset,
    };

    // Right clip
    const rightClip: AudioClip = {
      ...clipToSplit,
      id: `clip_${Date.now()}_b`,
      startTime: clipToSplit.startTime + splitOffset,
      offsetInOriginal: clipToSplit.offsetInOriginal + splitOffset,
      duration: clipToSplit.duration - splitOffset,
    };

    const newClips: AudioClip[] = [];
    for (const c of currentTrack.clips) {
      if (c.id === clipToSplit.id) {
        newClips.push(leftClip, rightClip);
      } else {
        newClips.push(c);
      }
    }

    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) => (t.id === currentTrack.id ? { ...t, clips: newClips } : t)),
    });
  };

  // EDIT OPERATION 2: TRIM selection (keep only selection)
  const handleTrim = () => {
    if (!selection) return;
    const currentTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) return;

    const updatedClips: AudioClip[] = [];

    for (const clip of currentTrack.clips) {
      const clipStart = clip.startTime + currentTrack.timeOffset;
      const clipEnd = clipStart + clip.duration;

      // Overlap with selection
      const trimStart = Math.max(clipStart, selection.startTime);
      const trimEnd = Math.min(clipEnd, selection.endTime);

      if (trimEnd > trimStart + 0.05) {
        const offsetDelta = trimStart - clipStart;
        updatedClips.push({
          ...clip,
          startTime: trimStart - currentTrack.timeOffset,
          offsetInOriginal: clip.offsetInOriginal + offsetDelta,
          duration: trimEnd - trimStart,
        });
      }
    }

    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) => (t.id === currentTrack.id ? { ...t, clips: updatedClips } : t)),
    });
  };

  // EDIT OPERATION 3: DELETE selection or active clip
  const handleDelete = (ripple = false) => {
    const currentTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) return;

    let targetClips: AudioClip[] = [];

    if (selection) {
      const updatedClips: AudioClip[] = [];

      for (const clip of currentTrack.clips) {
        const clipStart = clip.startTime + currentTrack.timeOffset;
        const clipEnd = clipStart + clip.duration;

        // No overlap
        if (selection.endTime <= clipStart || selection.startTime >= clipEnd) {
          updatedClips.push(clip);
          continue;
        }

        // Selection encompasses entire clip -> completely deleted
        if (selection.startTime <= clipStart && selection.endTime >= clipEnd) {
          continue;
        }

        // Selection cuts start of clip
        if (selection.startTime <= clipStart && selection.endTime < clipEnd) {
          const cutDuration = selection.endTime - clipStart;
          updatedClips.push({
            ...clip,
            startTime: selection.endTime - currentTrack.timeOffset,
            offsetInOriginal: clip.offsetInOriginal + cutDuration,
            duration: clip.duration - cutDuration,
          });
        }
        // Selection cuts end of clip
        else if (selection.startTime > clipStart && selection.endTime >= clipEnd) {
          const remainingDuration = selection.startTime - clipStart;
          updatedClips.push({
            ...clip,
            duration: remainingDuration,
          });
        }
        // Selection is in middle of clip -> split into 2
        else if (selection.startTime > clipStart && selection.endTime < clipEnd) {
          const firstDuration = selection.startTime - clipStart;
          const secondOffset = selection.endTime - clipStart;

          updatedClips.push({
            ...clip,
            duration: firstDuration,
          });

          updatedClips.push({
            ...clip,
            id: `clip_${Date.now()}_del`,
            startTime: selection.endTime - currentTrack.timeOffset,
            offsetInOriginal: clip.offsetInOriginal + secondOffset,
            duration: clip.duration - secondOffset,
          });
        }
      }

      targetClips = updatedClips;
      setSelection(null);
    } else if (selectedClip) {
      // Delete selected clip
      targetClips = currentTrack.clips.filter((c) => c.id !== selectedClip.id);
    }

    if (ripple && targetClips.length > 0) {
      const tempTrack = { ...currentTrack, clips: targetClips };
      const { newClips, gapsRemoved, timeSaved } = closeTrackGaps(tempTrack);
      targetClips = newClips;
      setSuccessMessage(`Part deleted & empty space removed (${timeSaved.toFixed(1)}s closed)`);
    }

    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) => (t.id === currentTrack.id ? { ...t, clips: targetClips } : t)),
    });
  };

  // 1-Click Close Gaps (Remove all empty spaces left behind by deleted parts)
  const handleCloseGaps = (targetTrackId?: string) => {
    const trackId = targetTrackId || selectedTrackId;
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track || track.clips.length === 0) {
      setErrorMessage('Is track par koi audio clips nahi hain.');
      return;
    }

    const { newClips, gapsRemoved, timeSaved } = closeTrackGaps(track);
    if (gapsRemoved === 0) {
      setErrorMessage('Is track par koi khali jagah (gap) nahi mili.');
      return;
    }

    const updatedTracks = project.tracks.map((t) =>
      t.id === track.id ? { ...t, clips: newClips } : t
    );

    commitProjectState({
      ...project,
      tracks: updatedTracks,
    });

    setSuccessMessage(`${gapsRemoved} empty ${gapsRemoved === 1 ? 'space' : 'spaces'} removed (${timeSaved.toFixed(1)}s gap closed)!`);
  };

  // Step playhead forward or backward (Aghe / Peeche step buttons)
  const handleStepTime = (deltaSeconds: number) => {
    const newTime = Math.max(0, Math.min(totalDuration, currentTime + deltaSeconds));
    handleSeek(newTime);
  };

  // Fit entire project into viewport width
  const handleZoomFit = () => {
    const availableWidth = window.innerWidth;
    const fitZoom = Math.max(10, Math.min(300, Math.floor((availableWidth - 40) / Math.max(5, totalDuration))));
    setZoom(fitZoom);
  };

  // EDIT OPERATION 4: COPY
  const handleCopy = () => {
    if (selectedClip) {
      setClipboardClip({ ...selectedClip });
    }
  };

  // EDIT OPERATION 5: PASTE
  const handlePaste = () => {
    if (!clipboardClip) return;
    const currentTrack = project.tracks.find((t) => t.id === selectedTrackId);
    if (!currentTrack) return;

    const pastedClip: AudioClip = {
      ...clipboardClip,
      id: `clip_paste_${Date.now()}`,
      trackId: currentTrack.id,
      startTime: currentTime,
    };

    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) =>
        t.id === currentTrack.id ? { ...t, clips: [...t.clips, pastedClip] } : t
      ),
    });

    setSelection({
      trackId: currentTrack.id,
      clipId: pastedClip.id,
      startTime: currentTime,
      endTime: currentTime + pastedClip.duration,
    });
  };

  // UNDO / REDO
  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [project, ...prev]);
    setProject(previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, project]);
    setProject(next);
  };

  // Clip update from Tools Panel
  const handleUpdateClip = (updatedClip: AudioClip) => {
    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) =>
        t.id === updatedClip.trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === updatedClip.id ? updatedClip : c)),
            }
          : t
      ),
    });
  };

  // Replace one clip with multiple (e.g. Silence Remover)
  const handleReplaceClipWithClips = (oldClipId: string, newClips: AudioClip[]) => {
    commitProjectState({
      ...project,
      tracks: project.tracks.map((t) => ({
        ...t,
        clips: t.clips.flatMap((c) => (c.id === oldClipId ? newClips : [c])),
      })),
    });
  };

  const hasClips = project.tracks.some((t) => t.clips.length > 0);
  const activeTrack = project.tracks.find((t) => t.id === selectedTrackId);
  const gapInfo = activeTrack ? detectGaps(activeTrack) : { gapsCount: 0, totalGapDuration: 0 };

  return (
    <div className="flex flex-col h-screen w-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      {/* Hidden File Input for Native File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header */}
      <HeaderBar
        currentTime={currentTime}
        totalDuration={totalDuration}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        isAutoSaved={isAutoSaved}
      />

      {/* Success Notification Toast */}
      {successMessage && (
        <div className="bg-emerald-950/90 border-b border-emerald-600/80 text-emerald-200 px-3 py-1.5 flex items-center justify-between text-xs z-40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-emerald-400 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800/80 text-red-300 px-3 py-2 flex items-center justify-between text-xs z-40">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-red-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Multitrack Controls Header */}
      <TrackControls
        tracks={project.tracks}
        selectedTrackId={selectedTrackId}
        onSelectTrack={handleSelectTrack}
        onUpdateTrack={handleUpdateTrack}
        onAddTrack={handleAddTrack}
        onDeleteTrack={handleDeleteTrack}
      />

      {/* Main Waveform Timeline Screen */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!hasClips && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/80 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-lg">
              <Music className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-200">No Audio Imported Yet</h2>
              <p className="text-xs text-slate-400 max-w-xs">
                Import an MP3, WAV, or M4A audio file, or record directly from your microphone to start editing.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 pointer-events-auto">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Upload className="w-4 h-4" />
                Import Audio
              </button>
              <button
                onClick={() => setIsRecordOpen(true)}
                className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all"
              >
                <Mic className="w-4 h-4 text-red-400" />
                Record Mic
              </button>
            </div>
          </div>
        )}

        <WaveformTimeline
          tracks={project.tracks}
          selectedTrackId={selectedTrackId}
          onSelectTrack={handleSelectTrack}
          audioEngine={audioEngine}
          currentTime={currentTime}
          selection={selection}
          onSelectionChange={setSelection}
          onSeek={handleSeek}
          zoom={zoom}
          onZoomChange={setZoom}
          silencePreviews={silencePreviews}
          maxDuration={totalDuration}
        />
      </div>

      {/* Navigation & Zoom Bar (Aghe/Peeche, Zoom Sliders & 1-Click Close Gaps) */}
      <TimelineNavZoomBar
        currentTime={currentTime}
        totalDuration={totalDuration}
        zoom={zoom}
        onZoomChange={setZoom}
        onZoomFit={handleZoomFit}
        onSeek={handleSeek}
        onStepTime={handleStepTime}
        gapInfo={gapInfo}
        onCloseGaps={() => handleCloseGaps()}
        hasClips={hasClips}
      />

      {/* Bottom Sticky Toolbar with 44px+ touch targets */}
      <BottomToolbar
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        isLooping={isLooping}
        onToggleLoop={handleToggleLoop}
        canUndo={historyPast.length > 0}
        onUndo={handleUndo}
        canRedo={historyFuture.length > 0}
        onRedo={handleRedo}
        onSplit={handleSplit}
        onTrim={handleTrim}
        onDelete={() => handleDelete(false)}
        onRippleDelete={() => handleDelete(true)}
        onCloseGaps={() => handleCloseGaps()}
        gapsCount={gapInfo.gapsCount}
        onCopy={handleCopy}
        canPaste={clipboardClip !== null}
        onPaste={handlePaste}
        onOpenTools={() => setIsToolsOpen(true)}
        onOpenEffects={() => setIsEffectsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenRecord={() => setIsRecordOpen(true)}
        onImportClick={() => fileInputRef.current?.click()}
        hasSelection={selection !== null}
        hasClips={hasClips}
      />

      {/* Bottom Sheet Panels */}
      <ToolsPanel
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        selectedClip={selectedClip}
        selection={selection}
        audioEngine={audioEngine}
        onUpdateClip={handleUpdateClip}
        onReplaceClipWithClips={handleReplaceClipWithClips}
        onPreviewSilenceChange={setSilencePreviews}
      />

      <EffectsPanel
        isOpen={isEffectsOpen}
        onClose={() => setIsEffectsOpen(false)}
        effects={project.effects}
        onChangeEffects={(newEffects) =>
          commitProjectState({
            ...project,
            effects: newEffects,
          })
        }
        audioEngine={audioEngine}
        selectedClip={selectedClip}
        onUpdateClip={handleUpdateClip}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        tracks={project.tracks}
        effects={project.effects}
        audioEngine={audioEngine}
        maxDuration={totalDuration}
      />

      <RecordModal
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
        onRecordingComplete={handleRecordingComplete}
      />
    </div>
  );
};
