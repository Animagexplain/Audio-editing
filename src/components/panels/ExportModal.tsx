import React, { useState } from 'react';
import { Track, EffectsConfig } from '../../types';
import { Download, Share2, FileAudio, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  ExportFormat,
  isM4aSupported,
  renderProjectOffline,
  audioBufferToWav,
  audioBufferToMp3,
  downloadBlob,
  shareAudioFile,
} from '../../audio/AudioExporter';
import { AudioEngine } from '../../audio/AudioEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  effects: EffectsConfig;
  audioEngine: AudioEngine;
  maxDuration: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tracks,
  effects,
  audioEngine,
  maxDuration,
}) => {
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!isOpen) return null;

  const m4aAvailable = isM4aSupported();

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(0.05);
    setStatusMessage('Rendering offline audio mix...');
    setExportedBlob(null);

    try {
      // 1. Offline rendering
      const buffers = audioEngine.getAllBuffers();
      const renderedBuffer = await renderProjectOffline(
        tracks,
        buffers,
        effects,
        maxDuration,
        (p) => setProgress(p * 0.5)
      );

      setStatusMessage(`Encoding to ${format.toUpperCase()}...`);

      let blob: Blob;
      let filename = `Audio_Export_${Date.now()}`;

      if (format === 'wav') {
        setProgress(0.8);
        blob = audioBufferToWav(renderedBuffer);
        filename += '.wav';
      } else if (format === 'mp3') {
        blob = audioBufferToMp3(renderedBuffer, 192, (p) => {
          setProgress(0.5 + p * 0.45);
        });
        filename += '.mp3';
      } else {
        // Fallback for m4a or wav
        blob = audioBufferToWav(renderedBuffer);
        filename += '.wav';
      }

      setProgress(1.0);
      setStatusMessage('Export complete!');
      setExportedBlob(blob);
      setExportedFilename(filename);
    } catch (err: any) {
      alert(`Export error: ${err.message || err}`);
      setStatusMessage('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!exportedBlob) return;
    await shareAudioFile(exportedBlob, exportedFilename, 'Exported Audio Master');
  };

  const handleDownload = () => {
    if (!exportedBlob) return;
    downloadBlob(exportedBlob, exportedFilename);
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
            <FileAudio className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">Export Master Audio</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Format Selector */}
        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">Output Format</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFormat('wav')}
              className={`min-h-[44px] px-3 py-2 rounded-lg font-bold text-xs border transition-all ${
                format === 'wav'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              WAV (16-bit)
            </button>

            <button
              onClick={() => setFormat('mp3')}
              className={`min-h-[44px] px-3 py-2 rounded-lg font-bold text-xs border transition-all ${
                format === 'mp3'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              MP3 (192k)
            </button>

            {m4aAvailable ? (
              <button
                onClick={() => setFormat('m4a')}
                className={`min-h-[44px] px-3 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'm4a'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                M4A (AAC)
              </button>
            ) : null}
          </div>

          {!m4aAvailable && (
            <div className="flex items-start gap-1.5 p-2 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-400">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                M4A encoding is not natively supported by your browser's MediaRecorder engine; please export in high-quality MP3 or WAV.
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar & Status */}
        {isExporting && (
          <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                {statusMessage}
              </span>
              <span className="font-mono text-cyan-300 font-bold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Export Completed Actions */}
        {exportedBlob && !isExporting && (
          <div className="space-y-3 bg-cyan-950/20 border border-cyan-800/40 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Ready: {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleShare}
                className="min-h-[44px] px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs shadow-md"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              <button
                onClick={handleDownload}
                className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-700"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        )}

        {/* Main Action Button */}
        {!exportedBlob && (
          <button
            onClick={handleStartExport}
            disabled={isExporting || maxDuration <= 0}
            className="w-full min-h-[44px] py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-900/30"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering Master Audio...
              </>
            ) : (
              <>
                <FileAudio className="w-4 h-4" />
                Render & Export {format.toUpperCase()}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
