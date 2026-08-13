import { describe, expect, it } from 'vitest';
import { PHYSICS } from './physics.js';
import { LANDING_PAD } from './terrain.js';
import { INITIAL_FUEL, SCORING, Simulation, calculateLandingScore, classifyContact } from './simulation.js';

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
  it('awards the maximum score for an immediate landing with full fuel', () => {
    expect(calculateLandingScore({ elapsed: 0, fuelRemaining: INITIAL_FUEL })).toBe(SCORING.maxScore);
  });

  it('reduces the score for more time or less fuel', () => {
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL }))
      .toBeGreaterThan(calculateLandingScore({ elapsed: 60, fuelRemaining: INITIAL_FUEL }));
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: 80 }))
      .toBeLessThan(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL }));
  });

  it('keeps scores bounded and integral', () => {
    expect(calculateLandingScore({ elapsed: -10, fuelRemaining: 200 })).toBe(SCORING.maxScore);
    expect(calculateLandingScore({ elapsed: 1000, fuelRemaining: -5 })).toBe(0);
    expect(Number.isInteger(calculateLandingScore({ elapsed: 12.345, fuelRemaining: 67.89 }))).toBe(true);
  });

  it('awards a safe landing score using the final simulation step', () => {
    const simulation = new Simulation();
    simulation.lander = {
      ...simulation.lander,
      x: LANDING_PAD.x,
      y: LANDING_PAD.y + PHYSICS.landerHeight / 2 + 0.01,
      vx: 0,
      vy: 0,
      fuel: 80,
    };

    simulation.step({ throttle: 0, rotation: 0 }, 0.1);

    expect(simulation.status).toBe('landed');
    expect(simulation.score).toBe(calculateLandingScore({
      elapsed: 0.1,
      fuelRemaining: 80,
      initialFuel: INITIAL_FUEL,
    }));
  });

  it('does not score failed missions and keeps a landing score stable', () => {
    const crashed = new Simulation();
    crashed.lander = {
      ...crashed.lander,
      x: LANDING_PAD.x,
      y: LANDING_PAD.y + PHYSICS.landerHeight / 2,
      vx: 20,
      vy: 0,
    };
    crashed.step({ throttle: 0, rotation: 0 });
    expect(crashed.status).toBe('crashed');
    expect(crashed.score).toBeNull();

    const landed = new Simulation();
    landed.lander = {
      ...landed.lander,
      x: LANDING_PAD.x,
      y: LANDING_PAD.y + PHYSICS.landerHeight / 2,
      vx: 0,
      vy: 0,
    };
    landed.step({ throttle: 0, rotation: 0 });
    const score = landed.score;
    const elapsed = landed.elapsed;
    const fuel = landed.lander.fuel;
    landed.step({ throttle: 1, rotation: 1 });
    expect(landed.score).toBe(score);
    expect(landed.elapsed).toBe(elapsed);
    expect(landed.lander.fuel).toBe(fuel);
  });

  it('does not score a lost mission', () => {
    const simulation = new Simulation();
    simulation.lander.x = -31;

    simulation.step({ throttle: 0, rotation: 0 });

    expect(simulation.status).toBe('lost');
    expect(simulation.score).toBeNull();
  });

  it('produces the same score for identical fixed-step flights', () => {
    const first = new Simulation();
    const second = new Simulation();
    for (const simulation of [first, second]) {
      simulation.lander = {
        ...simulation.lander,
        x: LANDING_PAD.x,
        y: LANDING_PAD.y + PHYSICS.landerHeight / 2,
        vx: 0,
        vy: 0,
      };
    }

    first.step({ throttle: 0, rotation: 0 }, 0.1);
    second.step({ throttle: 0, rotation: 0 }, 0.1);

    expect(first.score).toBe(second.score);
  });

  it('resets to a stable idle state', () => {
    const simulation = new Simulation();
    simulation.start();
    simulation.step({ throttle: 1, rotation: 1 });
    simulation.reset();

    expect(simulation.status).toBe('idle');
    expect(simulation.elapsed).toBe(0);
    expect(simulation.score).toBeNull();
    expect(simulation.trajectory).toEqual([]);
  });
});
