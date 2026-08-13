import { describe, expect, it } from 'vitest';
import { Simulation, STEP_SECONDS } from './game/simulation.js';
import { SAMPLE_PROGRAM } from './sample-program.js';

describe('starter guidance program', () => {
  it('crashes until the player adds horizontal guidance', () => {
    const update = new Function(`${SAMPLE_PROGRAM}\nreturn update;`)();
    const simulation = new Simulation();
    simulation.start();

    for (let step = 0; step < 60 * 120 && simulation.status === 'running'; step += 1) {
      simulation.step(update(simulation.telemetry()), STEP_SECONDS);
    }

    expect(simulation.status).toBe('crashed');
  });
});
