import { describe, expect, it } from 'vitest';
import { PHYSICS } from './physics.js';
import { LANDING_PAD } from './terrain.js';
import { Simulation, classifyContact } from './simulation.js';

describe('contact classification', () => {
  const safeLander = {
    x: LANDING_PAD.x,
    y: LANDING_PAD.y + PHYSICS.landerHeight / 2,
    vx: 2,
    vy: -8,
    angle: 0.05,
  };

  it('accepts a gentle upright contact on the pad', () => {
    expect(classifyContact(safeLander)).toBe('landed');
  });

  it.each([
    ['off the pad', { x: LANDING_PAD.left - 1 }],
    ['descending too quickly', { vy: -20 }],
    ['moving sideways too quickly', { vx: 15 }],
    ['tilted too far', { angle: 0.3 }],
  ])('rejects contact when %s', (_reason, change) => {
    expect(classifyContact({ ...safeLander, ...change })).toBe('crashed');
  });
});

describe('Simulation', () => {
  it('resets to a stable idle state', () => {
    const simulation = new Simulation();
    simulation.start();
    simulation.step({ throttle: 1, rotation: 1 });
    simulation.reset();

    expect(simulation.status).toBe('idle');
    expect(simulation.elapsed).toBe(0);
    expect(simulation.trajectory).toEqual([]);
  });
});
