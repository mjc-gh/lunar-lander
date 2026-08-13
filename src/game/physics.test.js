import { describe, expect, it } from 'vitest';
import { PHYSICS, integrateLander, sanitizeControls } from './physics.js';

const lander = {
  x: 100,
  y: 400,
  vx: 0,
  vy: 0,
  angle: 0,
  angularVelocity: 0,
  fuel: 100,
  throttle: 0,
};

describe('sanitizeControls', () => {
  it('clamps values and replaces invalid inputs', () => {
    expect(sanitizeControls({ throttle: 3, rotation: -4 })).toEqual({ throttle: 1, rotation: -1 });
    expect(sanitizeControls({ throttle: Number.NaN, rotation: undefined })).toEqual({ throttle: 0, rotation: 0 });
  });
});

describe('integrateLander', () => {
  it('accelerates downward under gravity', () => {
    const next = integrateLander(lander, { throttle: 0, rotation: 0 }, 1);
    expect(next.vy).toBe(-PHYSICS.gravity);
    expect(next.y).toBeLessThan(lander.y);
  });

  it('accelerates upward and burns fuel under full thrust', () => {
    const next = integrateLander(lander, { throttle: 1, rotation: 0 }, 1);
    expect(next.vy).toBe(PHYSICS.thrustAcceleration - PHYSICS.gravity);
    expect(next.fuel).toBeLessThan(lander.fuel);
  });

  it('cannot thrust without fuel', () => {
    const next = integrateLander({ ...lander, fuel: 0 }, { throttle: 1, rotation: 0 }, 1);
    expect(next.vy).toBe(-PHYSICS.gravity);
    expect(next.throttle).toBe(0);
  });
});
