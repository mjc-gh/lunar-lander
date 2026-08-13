const WORKER_STARTUP_TIMEOUT_MS = 2000;
const EXECUTION_TIMEOUT_MS = 100;

export class PlayerRuntime {
  constructor({ onError }) {
    this.onError = onError;
    this.sequence = 0;
    this.pending = null;
    this.worker = null;
    this.startupTimeout = null;
    this.compilationTimeout = null;
  }

  compile(source) {
    this.dispose();
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./player-worker.js', import.meta.url), { type: 'module' });
      this.worker = worker;
      this.startupTimeout = window.setTimeout(
        () => this.fail('Guidance worker took too long to start.', reject),
        WORKER_STARTUP_TIMEOUT_MS,
      );

      worker.onmessage = ({ data }) => {
        if (worker !== this.worker) return;

        if (data.type === 'booted') {
          window.clearTimeout(this.startupTimeout);
          this.startupTimeout = null;
          this.compilationTimeout = window.setTimeout(
            () => this.fail('Program took too long to initialize.', reject),
            EXECUTION_TIMEOUT_MS,
          );
          worker.postMessage({ type: 'compile', source });
        } else if (data.type === 'ready') {
          window.clearTimeout(this.compilationTimeout);
          this.compilationTimeout = null;
          resolve();
        } else if (data.type === 'error') {
          this.fail(data.message, reject);
        } else if (data.type === 'controls' && this.pending?.id === data.id) {
          window.clearTimeout(this.pending.timeout);
          const callback = this.pending.callback;
          this.pending = null;
          callback(data.controls);
        }
      };
      worker.onerror = () => this.fail('The guidance worker stopped unexpectedly.', reject);
    });
  }

  request(telemetry, callback) {
    if (!this.worker || this.pending) return false;
    const id = ++this.sequence;
    const timeout = window.setTimeout(() => this.fail('Program exceeded the 100 ms execution limit.'), EXECUTION_TIMEOUT_MS);
    this.pending = { id, callback, timeout };
    this.worker.postMessage({ type: 'tick', id, telemetry });
    return true;
  }

  fail(message, reject) {
    reject?.(new Error(message));
    this.onError(message);
    this.dispose();
  }

  dispose() {
    window.clearTimeout(this.startupTimeout);
    window.clearTimeout(this.compilationTimeout);
    if (this.pending) window.clearTimeout(this.pending.timeout);
    this.worker?.terminate();
    this.worker = null;
    this.startupTimeout = null;
    this.compilationTimeout = null;
    this.pending = null;
  }
}
