import { ProjectState } from '../types';
import { audioBufferToWav } from '../audio/AudioExporter';

const DB_NAME = 'AudioEditor_DB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_BUFFERS = 'audio_buffers';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BUFFERS)) {
        db.createObjectStore(STORE_BUFFERS, { keyPath: 'bufferId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves project state and underlying AudioBuffers to IndexedDB.
 */
export async function saveProjectToStorage(
  project: ProjectState,
  buffers: Map<string, AudioBuffer>
): Promise<void> {
  const db = await openDB();

  return new Promise(async (resolve, reject) => {
    try {
      const tx = db.transaction([STORE_PROJECTS, STORE_BUFFERS], 'readwrite');
      const projectStore = tx.objectStore(STORE_PROJECTS);
      const bufferStore = tx.objectStore(STORE_BUFFERS);

      projectStore.put({
        ...project,
        updatedAt: Date.now(),
      });

      // Save each audio buffer as a WAV blob
      for (const [bufferId, audioBuffer] of buffers.entries()) {
        const wavBlob = audioBufferToWav(audioBuffer);
        bufferStore.put({
          bufferId,
          blob: wavBlob,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Restores the most recently saved project from IndexedDB.
 */
export async function loadLatestProjectFromStorage(
  audioCtx: BaseAudioContext
): Promise<{ project: ProjectState; buffers: Map<string, AudioBuffer> } | null> {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_BUFFERS], 'readonly');
    const projectStore = tx.objectStore(STORE_PROJECTS);
    const bufferStore = tx.objectStore(STORE_BUFFERS);

    const projects: ProjectState[] = await new Promise((res, rej) => {
      const req = projectStore.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!projects || projects.length === 0) {
      return null;
    }

    // Pick latest by updatedAt
    projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const latestProject = projects[0];

    // Collect bufferIds needed by project clips
    const neededBufferIds = new Set<string>();
    for (const track of latestProject.tracks) {
      for (const clip of track.clips) {
        neededBufferIds.add(clip.bufferId);
      }
    }

    const buffers = new Map<string, AudioBuffer>();

    for (const bufferId of neededBufferIds) {
      const record: any = await new Promise((res, rej) => {
        const req = bufferStore.get(bufferId);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });

      if (record && record.blob) {
        const arrayBuf = await record.blob.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        buffers.set(bufferId, decoded);
      }
    }

    return { project: latestProject, buffers };
  } catch (err) {
    console.warn('Could not restore project from IndexedDB:', err);
    return null;
  }
}
