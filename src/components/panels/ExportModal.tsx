import React, { useState, useEffect } from 'react';
import { Track, EffectsConfig } from '../../types';
import { Download, Share2, FileAudio, CheckCircle2, AlertCircle, Loader2, Play, Volume2, FolderDown } from 'lucide-react';
import {
  ExportFormat,
  isM4aSupported,
  isOggSupported,
  isFlacSupported,
  renderProjectOffline,
  audioBufferToWav,
  audioBufferToMp3,
  audioBufferToM4a,
  audioBufferToOgg,
  audioBufferToFlac,
  saveAudioFileToDevice,
  shareAudioFile,
  promptSaveAsToDevice,
  isAndroidApp,
  downloadBlob,
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exportedFilename, setExportedFilename] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [saveLocation, setSaveLocation] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const m4aAvailable = isM4aSupported();
  const oggAvailable = isOggSupported();
  const flacAvailable = isFlacSupported();

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(0.05);
    setStatusMessage('Rendering audio edits and effects...');
    setExportedBlob(null);
    setSaveLocation('');
    setExportError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    try {
      // 1. Offline rendering with all cuts, splits, tracks, volume, fades, and effects
      const buffers = audioEngine.getAllBuffers();
      const renderedBuffer = await renderProjectOffline(
        tracks,
        buffers,
        effects,
        maxDuration,
        (p) => setProgress(p * 0.5)
      );

      setStatusMessage(`Encoding master to ${format.toUpperCase()}...`);

      let blob: Blob;
      let filename = `Audio_Export_${Date.now()}`;

      if (format === 'wav') {
        setProgress(0.75);
        blob = audioBufferToWav(renderedBuffer);
        filename += '.wav';
      } else if (format === 'mp3') {
        blob = audioBufferToMp3(renderedBuffer, 192, (p) => {
          setProgress(0.5 + p * 0.35);
        });
        filename += '.mp3';
      } else if (format === 'm4a') {
        blob = await audioBufferToM4a(renderedBuffer, (p) => {
          setProgress(0.5 + p * 0.35);
        });
        filename += '.m4a';
      } else if (format === 'ogg') {
        blob = await audioBufferToOgg(renderedBuffer, (p) => {
          setProgress(0.5 + p * 0.35);
        });
        filename += '.ogg';
      } else if (format === 'flac') {
        blob = await audioBufferToFlac(renderedBuffer, (p) => {
          setProgress(0.5 + p * 0.35);
        });
        filename += '.flac';
      } else {
        blob = audioBufferToWav(renderedBuffer);
        filename += '.wav';
      }

      setProgress(0.85);
      setStatusMessage('Saving audio to device storage...');

      // 2. Automatically save audio to device (Android MediaStore / Music folder or browser Downloads)
      const saveRes = await saveAudioFileToDevice(blob, filename, (saveP) => {
        setProgress(0.85 + saveP * 0.14);
      });

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setExportedBlob(blob);
      setExportedFilename(filename);
      setProgress(1.0);
      setStatusMessage('Export complete and saved!');
      setSaveLocation(saveRes.path || filename);
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError(err?.message || 'Export error occurred');
      setStatusMessage('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!exportedBlob) return;
    await shareAudioFile(exportedBlob, exportedFilename, 'Exported Audio Master');
  };

  const handleDownloadAgain = () => {
    if (!exportedBlob) return;
    downloadBlob(exportedBlob, exportedFilename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg active:scale-95 text-base"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Format Selector (only when not already exported) */}
        {!exportedBlob && (
          <div className="space-y-2">
            <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
              <span>Output Format</span>
              <span className="text-[11px] text-cyan-400 font-normal">WAV (Lossless) recommended</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setFormat('wav')}
                className={`min-h-[44px] px-2 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'wav'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                WAV (16-bit Lossless)
              </button>

              <button
                onClick={() => setFormat('mp3')}
                className={`min-h-[44px] px-2 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'mp3'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                MP3 (192 kbps)
              </button>

              <button
                onClick={() => setFormat('m4a')}
                className={`min-h-[44px] px-2 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'm4a'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                M4A (AAC)
              </button>

              <button
                onClick={() => setFormat('ogg')}
                className={`min-h-[44px] px-2 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'ogg'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                OGG (Opus)
              </button>

              <button
                onClick={() => setFormat('flac')}
                className={`min-h-[44px] px-2 py-2 rounded-lg font-bold text-xs border transition-all ${
                  format === 'flac'
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-xs'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                FLAC (Lossless)
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar & Status */}
        {isExporting && (
          <div className="space-y-2.5 bg-slate-950/90 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                {statusMessage}
              </span>
              <span className="font-mono text-cyan-300 font-bold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-cyan-500 to-emerald-400 transition-all duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {exportError && !isExporting && (
          <div className="bg-red-950/60 border border-red-800/80 rounded-xl p-3 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Export Failed</p>
              <p className="text-[11px] text-red-300 mt-0.5">{exportError}</p>
            </div>
          </div>
        )}

        {/* Export Completed Screen with Verification Preview & Native Actions */}
        {exportedBlob && !isExporting && (
          <div className="space-y-3.5 bg-emerald-950/25 border border-emerald-700/50 p-4 rounded-xl">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-emerald-300 text-sm">Audio Exported Successfully!</p>
                <p className="text-slate-300 font-mono text-[11px] break-all">{exportedFilename}</p>
                <p className="text-emerald-400/90 text-[11px] font-medium">
                  Size: {(exportedBlob.size / (1024 * 1024)).toFixed(2)} MB • Saved to device storage
                </p>
                {saveLocation && (
                  <p className="text-emerald-300/90 text-[11px] font-mono bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40 break-all">
                    📁 Saved to: {saveLocation}
                  </p>
                )}
              </div>
            </div>

            {/* Instant Audio Player Preview (To verify all edits) */}
            {previewUrl && (
              <div className="space-y-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Listen to Exported Audio:</span>
                </div>
                <audio controls src={previewUrl} className="w-full h-8 rounded" />
              </div>
            )}

            {/* Action Buttons */}
            <div className={`grid ${isAndroidApp() ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`}>
              <button
                onClick={handleShare}
                className="min-h-[44px] px-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs shadow-md shadow-cyan-900/30"
                title="Share via WhatsApp, Drive, Files"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Share</span>
              </button>

              {isAndroidApp() && (
                <button
                  onClick={() => promptSaveAsToDevice()}
                  className="min-h-[44px] px-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs shadow-md shadow-indigo-900/30"
                  title="Choose exact folder in device"
                >
                  <FolderDown className="w-4 h-4 shrink-0" />
                  <span>Choose Folder</span>
                </button>
              )}

              {previewUrl ? (
                <a
                  href={previewUrl}
                  download={exportedFilename}
                  onClick={handleDownloadAgain}
                  className="min-h-[44px] px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-700 shadow-xs text-center"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Save Again</span>
                </a>
              ) : (
                <button
                  onClick={handleDownloadAgain}
                  className="min-h-[44px] px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-700 shadow-xs"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Save Again</span>
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setExportedBlob(null);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }
                onClose();
              }}
              className="w-full min-h-[40px] py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition-colors"
            >
              Done & Close
            </button>
          </div>
        )}

        {/* Main Action Button (Render & Export) */}
        {!exportedBlob && (
          <button
            onClick={handleStartExport}
            disabled={isExporting || maxDuration <= 0}
            className="w-full min-h-[46px] py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-cyan-900/30"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering & Saving Master Audio...
              </>
            ) : (
              <>
                <FileAudio className="w-4 h-4" />
                Render & Save {format.toUpperCase()} to Device
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

