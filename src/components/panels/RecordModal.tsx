import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Circle, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { AudioRecorder } from '../../audio/AudioRecorder';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioBuffer: AudioBuffer, blob: Blob, duration: number) => void;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [peakDb, setPeakDb] = useState(-60);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [recordedTakesCount, setRecordedTakesCount] = useState(0);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleStart = async () => {
    setErrorMessage('');
    setLastSavedMessage(null);
    try {
      const recorder = new AudioRecorder((lvl, db) => {
        setLevel(lvl);
        setPeakDb(db);
      });
      recorderRef.current = recorder;

      await recorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 0.1);
      }, 100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Microphone access failed.');
    }
  };

  const handleStop = async () => {
    if (!recorderRef.current || !isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsDecoding(true);

    try {
      const result = await recorderRef.current.stop();
      const currentTakeNum = recordedTakesCount + 1;
      setRecordedTakesCount(currentTakeNum);

      // Add to timeline sequentially without mixing
      onRecordingComplete(result.audioBuffer, result.blob, result.duration);

      // Keep user on the recording modal so they can record another take with 1 click
      setLastSavedMessage(`Take ${currentTakeNum} timeline par save ho gaya (${result.duration.toFixed(1)}s)!`);
      setLevel(0);
      setPeakDb(-60);
    } catch (err: any) {
      setErrorMessage(`Failed to process recording: ${err.message}`);
    } finally {
      setIsDecoding(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const tenths = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              Audio Recording {recordedTakesCount > 0 && `(Take ${recordedTakesCount})`}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isRecording || isDecoding}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg active:scale-95"
            title="Close Recorder"
          >
            ✕
          </button>
        </div>

        {/* Success / Last Saved Feedback */}
        {lastSavedMessage && (
          <div className="p-2.5 bg-emerald-950/60 border border-emerald-700/60 rounded-xl flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{lastSavedMessage}</span>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Duration Time Display */}
        <div className="text-center py-4 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <div className="font-mono text-3xl font-bold tracking-wider text-slate-100">
            {formatTimer(duration)}
          </div>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider mt-1 block">
            {isRecording
              ? 'Recording Live...'
              : recordedTakesCount > 0
              ? 'Agli recording ke liye niche click karein'
              : 'Ready to record'}
          </span>
        </div>

        {/* Live Audio Level Meter */}
        <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Mic Input Level</span>
            <span className="font-mono text-slate-300 font-bold">
              {isRecording ? `${peakDb.toFixed(1)} dB` : '-∞ dB'}
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden p-0.5 flex items-center">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                peakDb > -1
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                  : peakDb > -6
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>-50dB</span>
            <span>-24dB</span>
            <span>-12dB</span>
            <span>-3dB</span>
            <span className="text-red-400">CLIP</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="pt-2 space-y-2">
          {isDecoding ? (
            <div className="flex items-center justify-center gap-2 py-3 text-cyan-300 text-xs font-medium bg-slate-800/50 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              Audio save ho rahi hai...
            </div>
          ) : isRecording ? (
            <button
              onClick={handleStop}
              className="w-full min-h-[48px] py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-red-900/30"
            >
              <Square className="w-4 h-4 fill-white" />
              Stop & Save Take (Timeline)
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleStart}
                className="w-full min-h-[48px] py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-red-900/30"
              >
                <Circle className="w-4 h-4 fill-white" />
                {recordedTakesCount > 0 ? 'Record Again (1-Click Next Take)' : 'Start Recording'}
              </button>

              {recordedTakesCount > 0 && (
                <button
                  onClick={onClose}
                  className="w-full min-h-[40px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl active:scale-95 transition-all text-xs"
                >
                  Done Recording (Close)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
