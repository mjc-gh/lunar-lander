let updateProgram = null;

self.postMessage({ type: 'booted' });

self.addEventListener('message', ({ data }) => {
  try {
    if (data.type === 'compile') {
      const createProgram = new Function(
        `"use strict";\n${data.source}\n` +
          'if (typeof update !== "function") throw new Error("Define a function named update(state).");\n' +
          'return update;',
      );
      updateProgram = createProgram();
      self.postMessage({ type: 'ready' });
      return;
    }

    if (data.type === 'tick' && updateProgram) {
      const controls = updateProgram(Object.freeze(data.telemetry));
      if (controls && typeof controls.then === 'function') {
        throw new Error('update(state) must return controls synchronously.');
      }
      self.postMessage({ type: 'controls', id: data.id, controls });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  }
});
