/**
 * Real-time Audio Recorder with live level meter and permission handling.
 */
export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recordedChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private onLevelChange?: (level: number, peakDb: number) => void;
  private isRecording: boolean = false;
  private startTime: number = 0;

  constructor(onLevelChange?: (level: number, peakDb: number) => void) {
    this.onLevelChange = onLevelChange;
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser environment.');
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please enable microphone access in your app settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device was found on this system.');
      } else {
        throw new Error(`Microphone initialization error: ${err.message || err.name}`);
      }
    }

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.4;
    source.connect(this.analyser);

    // Setup MediaRecorder
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    this.startTime = Date.now();

    // Start live level meter loop
    this.startLevelMeter();
  }

  private startLevelMeter() {
    if (!this.analyser) return;

    const dataArray = new Float32Array(this.analyser.fftSize);

    const updateMeter = () => {
      if (!this.isRecording || !this.analyser) return;

      this.analyser.getFloatTimeDomainData(dataArray);

      let sum = 0;
      let peak = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        const abs = Math.abs(val);
        if (abs > peak) peak = abs;
        sum += val * val;
      }

      const rms = Math.sqrt(sum / dataArray.length);
      const peakDb = peak > 0 ? 20 * Math.log10(peak) : -60;

      // Linear scale 0..1 for UI meter with -50dB floor
      const minDb = -50;
      const normalizedLevel = Math.max(0, Math.min(1, (peakDb - minDb) / -minDb));

      if (this.onLevelChange) {
        this.onLevelChange(normalizedLevel, peakDb);
      }

      this.animFrameId = requestAnimationFrame(updateMeter);
    };

    this.animFrameId = requestAnimationFrame(updateMeter);
  }

  async stop(): Promise<{ audioBuffer: AudioBuffer; blob: Blob; duration: number }> {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder was not initialized.'));
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });

          // Cleanup tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
          }

          // Decode recorded blob to AudioBuffer
          const arrayBuffer = await blob.arrayBuffer();
          const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
          const duration = audioBuffer.duration;

          if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
            this.audioContext = null;
          }

          resolve({ audioBuffer, blob, duration });
        } catch (err: any) {
          reject(new Error(`Failed to decode recorded audio: ${err.message}`));
        }
      };

      this.mediaRecorder.stop();
    });
  }

  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }
}
