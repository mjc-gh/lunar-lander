import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerRuntime } from './player-runtime.js';

class FakeWorker {
  static instances = [];

  constructor() {
    this.messages = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  emit(message) {
    this.onmessage({ data: message });
  }

  terminate() {
    this.terminated = true;
  }
}

describe('PlayerRuntime compilation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.instances = [];
    globalThis.window = { setTimeout, clearTimeout };
    globalThis.Worker = FakeWorker;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
    delete globalThis.Worker;
  });

  it('does not apply the execution timeout while the worker is booting', async () => {
    const runtime = new PlayerRuntime({ onError: vi.fn() });
    const compilation = runtime.compile('function update() { return {}; }');
    const worker = FakeWorker.instances[0];

    await vi.advanceTimersByTimeAsync(500);
    expect(worker.terminated).toBe(false);
    expect(worker.messages).toEqual([]);

    worker.emit({ type: 'booted' });
    expect(worker.messages).toEqual([
      { type: 'compile', source: 'function update() { return {}; }' },
    ]);
    worker.emit({ type: 'ready' });

    await expect(compilation).resolves.toBeUndefined();
  });

  it('clears startup timers when disposed', async () => {
    const onError = vi.fn();
    const runtime = new PlayerRuntime({ onError });
    runtime.compile('function update() { return {}; }');

    runtime.dispose();
    await vi.advanceTimersByTimeAsync(2500);

    expect(onError).not.toHaveBeenCalled();
  });
});
