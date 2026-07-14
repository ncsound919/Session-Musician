/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple utility to record audio from the microphone
 */
export class AudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];

  public async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start();
  }

  public async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      const recorder = this.mediaRecorder;

      recorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.mediaRecorder = null;

        // Stop all tracks to release the microphone
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;

        resolve(audioBlob);
      };

      recorder.onerror = (event: ErrorEvent) => {
        const error = event.error ?? new Error('Recording error');
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;
        reject(error);
      };

      try {
        recorder.stop();
      } catch (err) {
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;
        const error = err instanceof Error ? err : new Error(String(err));
        reject(error);
      }
    });
  }
}

export const audioCapture = new AudioCapture();
