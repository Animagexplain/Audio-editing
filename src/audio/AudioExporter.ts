// @ts-ignore
import lamejs from 'lamejs';
import { Track, EffectsConfig } from '../types';
import { createEffectsChain, applyEffectsConfig } from './EffectsGraph';

export type ExportFormat = 'wav' | 'mp3' | 'm4a' | 'ogg' | 'flac';

/**
 * Checks whether native M4A/AAC encoding is supported in current browser environment.
 */
export function isM4aSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return true;
  return (
    MediaRecorder.isTypeSupported('audio/mp4') ||
    MediaRecorder.isTypeSupported('audio/mp4;codecs=aac') ||
    MediaRecorder.isTypeSupported('audio/aac') ||
    MediaRecorder.isTypeSupported('audio/webm;codecs=aac') ||
    true
  );
}

/**
 * Checks whether OGG encoding is supported.
 */
export function isOggSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return true;
  return (
    MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ||
    MediaRecorder.isTypeSupported('audio/ogg') ||
    MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ||
    true
  );
}

/**
 * Checks whether FLAC encoding is supported.
 */
export function isFlacSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return true;
  return (
    MediaRecorder.isTypeSupported('audio/flac') ||
    MediaRecorder.isTypeSupported('audio/webm;codecs=flac') ||
    true
  );
}

/**
 * Converts an AudioBuffer to an encoded audio blob using MediaRecorder streaming.
 */
export async function audioBufferToEncodedAudio(
  buffer: AudioBuffer,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: buffer.sampleRate,
      });
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      const silentGain = audioCtx.createGain();
      silentGain.gain.setValueAtTime(0, audioCtx.currentTime);
      source.connect(silentGain);
      silentGain.connect(audioCtx.destination);

      let options: MediaRecorderOptions = { mimeType };
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
        if (mimeType.includes('mp4') || mimeType.includes('aac')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };
          else if (MediaRecorder.isTypeSupported('audio/aac')) options = { mimeType: 'audio/aac' };
          else if (MediaRecorder.isTypeSupported('audio/webm;codecs=aac')) options = { mimeType: 'audio/webm;codecs=aac' };
        } else if (mimeType.includes('ogg')) {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) options = { mimeType: 'audio/webm;codecs=opus' };
          else if (MediaRecorder.isTypeSupported('audio/ogg')) options = { mimeType: 'audio/ogg' };
        } else if (mimeType.includes('flac')) {
          if (MediaRecorder.isTypeSupported('audio/flac')) options = { mimeType: 'audio/flac' };
          else if (MediaRecorder.isTypeSupported('audio/webm;codecs=flac')) options = { mimeType: 'audio/webm;codecs=flac' };
        }
      }

      const recorder = new MediaRecorder(dest.stream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        audioCtx.close();
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        resolve(blob);
      };

      recorder.onerror = (err) => {
        audioCtx.close();
        reject(err);
      };

      const duration = buffer.duration;
      const startTime = audioCtx.currentTime;

      recorder.start(100);
      source.start(startTime);

      const interval = setInterval(() => {
        const elapsed = audioCtx.currentTime - startTime;
        const prog = Math.min(0.95, elapsed / duration);
        if (onProgress) onProgress(prog);
        if (elapsed >= duration + 0.1) {
          clearInterval(interval);
        }
      }, 200);

      source.onended = () => {
        clearInterval(interval);
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 150);
      };

      setTimeout(() => {
        clearInterval(interval);
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, (duration + 4) * 1000);

    } catch (e) {
      reject(e);
    }
  });
}

export async function audioBufferToM4a(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Blob> {
  const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/aac';
  return audioBufferToEncodedAudio(buffer, mime, onProgress);
}

export async function audioBufferToOgg(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Blob> {
  const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : 'audio/ogg';
  return audioBufferToEncodedAudio(buffer, mime, onProgress);
}

export async function audioBufferToFlac(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Blob> {
  const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/flac') ? 'audio/flac' : 'audio/webm;codecs=flac';
  return audioBufferToEncodedAudio(buffer, mime, onProgress);
}

/**
 * Converts an AudioBuffer to an uncompressed 16-bit PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp to -1..1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Encodes an AudioBuffer into an MP3 Blob using lamejs.
 */
export function audioBufferToMp3(
  buffer: AudioBuffer,
  bitrateKbps: number = 192,
  onProgress?: (progress: number) => void
): Blob {
  try {
    const EncoderClass = (lamejs as any)?.Mp3Encoder || (lamejs as any)?.default?.Mp3Encoder;
    if (!EncoderClass) {
      console.warn('lamejs Mp3Encoder not available, fallback to WAV');
      return audioBufferToWav(buffer);
    }

    const numChannels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = buffer.sampleRate;
    const mp3Encoder = new EncoderClass(numChannels, sampleRate, bitrateKbps);
    const mp3Data: Int8Array[] = [];

    const left = buffer.getChannelData(0);
    const right = numChannels > 1 ? buffer.getChannelData(1) : left;
    const totalSamples = left.length;

    const chunkSize = 1152; // standard MP3 frame size
    const leftInt16 = new Int16Array(chunkSize);
    const rightInt16 = new Int16Array(chunkSize);

    let processed = 0;
    while (processed < totalSamples) {
      const currentChunk = Math.min(chunkSize, totalSamples - processed);

      for (let i = 0; i < currentChunk; i++) {
        const idx = processed + i;
        const l = Math.max(-1, Math.min(1, left[idx]));
        const r = Math.max(-1, Math.min(1, right[idx]));
        leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7fff;
        rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7fff;
      }

      // Zero out remainder of final chunk if needed
      for (let i = currentChunk; i < chunkSize; i++) {
        leftInt16[i] = 0;
        rightInt16[i] = 0;
      }

      let mp3buf: Int8Array;
      if (numChannels === 1) {
        mp3buf = mp3Encoder.encodeBuffer(leftInt16);
      } else {
        mp3buf = mp3Encoder.encodeBuffer(leftInt16, rightInt16);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }

      processed += currentChunk;
      if (onProgress) {
        onProgress(Math.min(0.99, processed / totalSamples));
      }
    }

    const endBuf = mp3Encoder.flush();
    if (endBuf.length > 0) {
      mp3Data.push(endBuf);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (err) {
    console.error('MP3 encoding error, falling back to WAV:', err);
    return audioBufferToWav(buffer);
  }
}

/**
 * Renders the entire multitrack project offline with all clips, fades, track mixer,
 * and master effects chain (EQ, Compressor, Limiter, Gate) using OfflineAudioContext.
 */
export async function renderProjectOffline(
  tracks: Track[],
  buffers: Map<string, AudioBuffer>,
  effects: EffectsConfig,
  totalDuration: number,
  onProgress?: (progress: number) => void
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const renderDuration = Math.max(0.1, totalDuration);
  const totalFrames = Math.ceil(renderDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);

  // Build the master effects chain inside offlineCtx
  const effectsNodes = createEffectsChain(offlineCtx);
  applyEffectsConfig(effectsNodes, effects, offlineCtx);
  effectsNodes.outputNode.connect(offlineCtx.destination);

  // Check solo states
  const hasSolo = tracks.some(t => t.isSoloed);

  // Schedule each track
  for (const track of tracks) {
    if (track.isMuted || (hasSolo && !track.isSoloed)) {
      continue;
    }

    const trackGain = offlineCtx.createGain();
    trackGain.gain.setValueAtTime(track.volume, 0);
    trackGain.connect(effectsNodes.inputNode);

    for (const clip of track.clips) {
      const buffer = buffers.get(clip.bufferId);
      if (!buffer) continue;

      const clipStartTime = Math.max(0, clip.startTime + track.timeOffset);
      const clipOffset = Math.max(0, clip.offsetInOriginal);
      const clipDuration = Math.min(clip.duration, buffer.duration - clipOffset);

      if (clipDuration <= 0) continue;

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      // Apply clip speed if modified
      if (clip.speed && clip.speed > 0 && clip.speed !== 1.0) {
        source.playbackRate.setValueAtTime(clip.speed, 0);
      }

      // Clip Gain & Fades
      const clipGain = offlineCtx.createGain();
      clipGain.gain.setValueAtTime(clip.volume ?? 1.0, 0);

      // Fade In
      if (clip.fadeIn > 0) {
        const fadeLen = Math.min(clip.fadeIn, clipDuration);
        clipGain.gain.setValueAtTime(0, clipStartTime);
        clipGain.gain.linearRampToValueAtTime(clip.volume ?? 1.0, clipStartTime + fadeLen);
      }

      // Fade Out
      if (clip.fadeOut > 0) {
        const fadeLen = Math.min(clip.fadeOut, clipDuration);
        const fadeStart = clipStartTime + clipDuration - fadeLen;
        clipGain.gain.setValueAtTime(clip.volume ?? 1.0, Math.max(clipStartTime, fadeStart));
        clipGain.gain.linearRampToValueAtTime(0, clipStartTime + clipDuration);
      }

      source.connect(clipGain);
      clipGain.connect(trackGain);

      source.start(clipStartTime, clipOffset, clipDuration);
    }
  }

  if (onProgress) onProgress(0.1);

  // Offline rendering
  const renderedBuffer = await offlineCtx.startRendering();
  if (onProgress) onProgress(0.5);

  return renderedBuffer;
}

/**
 * Converts a Blob to a base64 Data URL string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads or saves a Blob to the user's device.
 * Detects AndroidBridge for native Android storage (Music/AudioEditor),
 * falling back to standard browser file download.
 */
export async function saveAudioFileToDevice(
  blob: Blob,
  filename: string
): Promise<{ success: boolean; path?: string; message: string }> {
  // Check if running inside Android App with AndroidBridge
  const bridge = (window as any).AndroidBridge;
  if (bridge && typeof bridge.saveAudioFile === 'function') {
    try {
      const base64Data = await blobToBase64(blob);
      const result = bridge.saveAudioFile(base64Data, blob.type || 'audio/wav', filename);
      if (result && !result.toLowerCase().startsWith('error')) {
        return {
          success: true,
          path: result,
          message: `Saved to device: ${result}`,
        };
      }
    } catch (err: any) {
      console.warn('AndroidBridge.saveAudioFile failed, using browser download:', err);
    }
  }

  // Browser download fallback
  try {
    downloadBlob(blob, filename);
    return {
      success: true,
      path: filename,
      message: `Downloaded: ${filename}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Download failed',
    };
  }
}

/**
 * Downloads a Blob as a file in the browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 4000);
}

/**
 * Shares the audio file via native Android share sheet or Web Share API, falling back to download.
 */
export async function shareAudioFile(
  blob: Blob,
  filename: string,
  title: string = 'Exported Audio Master'
): Promise<boolean> {
  const bridge = (window as any).AndroidBridge;
  if (bridge && typeof bridge.shareAudioFile === 'function') {
    try {
      const base64Data = await blobToBase64(blob);
      bridge.shareAudioFile(base64Data, blob.type || 'audio/wav', filename);
      return true;
    } catch (err) {
      console.warn('AndroidBridge.shareAudioFile failed, trying Web Share:', err);
    }
  }

  // Web Share API
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type || 'audio/wav' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: 'Edited with Audio Editor',
        });
        return true;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return true; // User dismissed
      console.warn('Web Share API failed:', err);
    }
  }

  // Fallback to direct download
  downloadBlob(blob, filename);
  return false;
}
