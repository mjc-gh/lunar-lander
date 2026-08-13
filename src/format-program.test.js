import { describe, expect, it } from 'vitest';
import { formatProgram } from './format-program.js';

describe('formatProgram', () => {
  it('formats guidance code with repository-style JavaScript', async () => {
    const formatted = await formatProgram("function update(state){return {throttle:state.altitude>10?1:0,rotation:0}}\n");

    expect(formatted).toBe(
      "function update(state) {\n  return { throttle: state.altitude > 10 ? 1 : 0, rotation: 0 };\n}\n",
    );
  });

  it('removes repeated blank lines while preserving comments', async () => {
    const formatted = await formatProgram(
      "// Keep this guidance note.\n\n\nfunction update(state){\n\n// Stabilize the lander.\nreturn {throttle:0.5,rotation:0}\n}\n",
    );

    expect(formatted).toContain('// Keep this guidance note.');
    expect(formatted).toContain('// Stabilize the lander.');
    expect(formatted).not.toMatch(/\n{3,}/);
    expect(formatted).toContain("return { throttle: 0.5, rotation: 0 };");
  });

  it('preserves the program result when formatted', async () => {
    const source = 'function update(state){return {throttle:state.altitude/10,rotation:-1}}';
    const formatted = await formatProgram(source);
    const originalUpdate = new Function(`${source}\nreturn update;`)();
    const formattedUpdate = new Function(`${formatted}\nreturn update;`)();

    expect(formattedUpdate({ altitude: 4 })).toEqual(originalUpdate({ altitude: 4 }));
  });

  it('rejects invalid JavaScript without returning a partial rewrite', async () => {
    await expect(formatProgram('function update(state) { return {')).rejects.toThrow();
  });
});
