// @ts-ignore
import { SoundTouch, SimpleFilter } from 'soundtouchjs';

/**
 * Custom sample source pipe for SoundTouchJS
 */
class BufferSourcePipe {
  private buffer: AudioBuffer;
  private channelData: Float32Array[];
  private position: number = 0;

  constructor(buffer: AudioBuffer) {
    this.buffer = buffer;
    this.channelData = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      this.channelData.push(buffer.getChannelData(c));
    }
  }

  extract(target: Float32Array, numFrames: number): number {
    const available = this.buffer.length - this.position;
    const framesToCopy = Math.min(numFrames, available);
    const channels = this.buffer.numberOfChannels;

    if (framesToCopy <= 0) return 0;

    let targetIdx = 0;
    if (channels === 1) {
      const ch0 = this.channelData[0];
      for (let i = 0; i < framesToCopy; i++) {
        const val = ch0[this.position + i];
        target[targetIdx++] = val;
        target[targetIdx++] = val; // Duplicate to stereo for soundtouch
      }
    } else {
      const ch0 = this.channelData[0];
      const ch1 = this.channelData[1];
      for (let i = 0; i < framesToCopy; i++) {
        target[targetIdx++] = ch0[this.position + i];
        target[targetIdx++] = ch1[this.position + i];
      }
    }

    this.position += framesToCopy;
    return framesToCopy;
  }
}

/**
 * Changes speed (tempo) and pitch independently using SoundTouchJS.
 * Speed: 0.5 to 2.0 (tempo factor, pitch unchanged)
 * Pitch: -12 to +12 semitones (pitch factor, speed unchanged)
 */
export async function processTimeStretch(
  audioContext: BaseAudioContext,
  sourceBuffer: AudioBuffer,
  speed: number = 1.0,
  pitchSemitones: number = 0
): Promise<AudioBuffer> {
  // If no change, return identical buffer clone
  if (Math.abs(speed - 1.0) < 0.005 && Math.abs(pitchSemitones) < 0.05) {
    return sourceBuffer;
  }

  try {
    const soundTouch = new SoundTouch();
    soundTouch.tempo = Math.max(0.25, Math.min(4.0, speed));
    const pitchFactor = Math.pow(2, pitchSemitones / 12);
    soundTouch.pitch = Math.max(0.25, Math.min(4.0, pitchFactor));

    const pipe = new BufferSourcePipe(sourceBuffer);
    const filter = new SimpleFilter(pipe, soundTouch);

    const outChunkSize = 4096;
    const outBufferInterleaved = new Float32Array(outChunkSize * 2);

    const outLeftChunks: Float32Array[] = [];
    const outRightChunks: Float32Array[] = [];
    let totalFrames = 0;

    while (true) {
      const framesExtracted = filter.extract(outBufferInterleaved, outChunkSize);
      if (framesExtracted === 0) break;

      const left = new Float32Array(framesExtracted);
      const right = new Float32Array(framesExtracted);

      for (let i = 0; i < framesExtracted; i++) {
        left[i] = outBufferInterleaved[i * 2];
        right[i] = outBufferInterleaved[i * 2 + 1];
      }

      outLeftChunks.push(left);
      outRightChunks.push(right);
      totalFrames += framesExtracted;
    }

    if (totalFrames === 0) return sourceBuffer;

    const resultBuffer = audioContext.createBuffer(
      sourceBuffer.numberOfChannels,
      totalFrames,
      sourceBuffer.sampleRate
    );

    // Stitch chunks into resultBuffer
    const destLeft = resultBuffer.getChannelData(0);
    const destRight = sourceBuffer.numberOfChannels > 1 ? resultBuffer.getChannelData(1) : null;

    let offset = 0;
    for (let c = 0; c < outLeftChunks.length; c++) {
      destLeft.set(outLeftChunks[c], offset);
      if (destRight) {
        destRight.set(outRightChunks[c], offset);
      }
      offset += outLeftChunks[c].length;
    }

    return resultBuffer;
  } catch (err) {
    console.warn('SoundTouch time-stretch fallback to resample:', err);
    return sourceBuffer;
  }
}
