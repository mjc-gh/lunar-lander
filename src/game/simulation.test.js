import { describe, expect, it } from 'vitest';
import { PHYSICS } from './physics.js';
import { LANDING_PAD } from './terrain.js';
import {
  INITIAL_FUEL,
  SCORING,
  Simulation,
  calculateLandingScore,
  calculateLandingScoreBreakdown,
  classifyContact,
} from './simulation.js';

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

  it.each([LANDING_PAD.x - 48, LANDING_PAD.x + 48])('accepts the safe center edge at x=%s', (x) => {
    expect(classifyContact({ ...safeLander, x })).toBe('landed');
  });

  it.each([LANDING_PAD.x - 49, LANDING_PAD.x + 49])('rejects a center just beyond the safe edge at x=%s', (x) => {
    expect(classifyContact({ ...safeLander, x })).toBe('crashed');
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
    expect(calculateLandingScore({ elapsed: 0, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x }))
      .toBe(SCORING.maxScore);
  });

  it('reduces the score as touchdown distance increases', () => {
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x }))
      .toBeGreaterThan(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x + 24 }));
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x + 24 }))
      .toBeGreaterThan(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x + 48 }));
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: 80, touchdownX: LANDING_PAD.x }))
      .toBeLessThan(calculateLandingScore({ elapsed: 30, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x }));
  });

  it('scores equal left and right offsets identically', () => {
    const options = { elapsed: 30, fuelRemaining: 80 };
    expect(calculateLandingScore({ ...options, touchdownX: LANDING_PAD.x - 18 }))
      .toBe(calculateLandingScore({ ...options, touchdownX: LANDING_PAD.x + 18 }));
  });

  it('keeps scores bounded and integral', () => {
    for (const touchdownX of [-Infinity, Infinity, NaN, -1000, 1000]) {
      const score = calculateLandingScore({ elapsed: -10, fuelRemaining: 200, touchdownX });
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(SCORING.maxScore);
    }
    expect(calculateLandingScore({ elapsed: 1000, fuelRemaining: -5, touchdownX: LANDING_PAD.x + 48 })).toBe(0);
    expect(Number.isInteger(calculateLandingScore({ elapsed: 12.345, fuelRemaining: 67.89, touchdownX: LANDING_PAD.x }))).toBe(true);
  });

  it('gives centered accuracy one and safe edges zero', () => {
    const maximumSafeOffset = (LANDING_PAD.right - LANDING_PAD.left) / 2 - PHYSICS.landerWidth / 2;
    const centered = calculateLandingScore({ elapsed: 0, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x });
    const leftEdge = calculateLandingScore({ elapsed: 0, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x - maximumSafeOffset });
    const rightEdge = calculateLandingScore({ elapsed: 0, fuelRemaining: INITIAL_FUEL, touchdownX: LANDING_PAD.x + maximumSafeOffset });
    expect(centered).toBe(10_000);
    expect(leftEdge).toBe(6_667);
    expect(rightEdge).toBe(6_667);
  });

  it('exposes the complete score calculation breakdown', () => {
    const maximumSafeOffset = 48;
    const breakdown = calculateLandingScoreBreakdown({
      elapsed: 30,
      fuelRemaining: 80,
      touchdownX: LANDING_PAD.x + 24,
    });

    expect(breakdown.maximumSafeOffset).toBe(maximumSafeOffset);
    expect(breakdown.padCenter).toBe(LANDING_PAD.x);
    expect(breakdown.touchdownOffset).toBe(24);
    expect(breakdown.timeEfficiency).toBe(0.75);
    expect(breakdown.fuelEfficiency).toBe(0.8);
    expect(breakdown.accuracyEfficiency).toBe(0.5);
    expect(breakdown.timePoints).toBe(2500);
    expect(breakdown.fuelPoints).toBeCloseTo(2666.6666666667);
    expect(breakdown.accuracyPoints).toBeCloseTo(1666.6666666667);
    expect(breakdown.unroundedTotal).toBeCloseTo(6833.3333333333);
    expect(breakdown.score).toBe(6833);
    expect(calculateLandingScore({ elapsed: 30, fuelRemaining: 80, touchdownX: LANDING_PAD.x + 24 }))
      .toBe(breakdown.score);
  });

  it('clamps every efficiency and keeps accuracy symmetric', () => {
    const centered = calculateLandingScoreBreakdown({ elapsed: -10, fuelRemaining: 200, touchdownX: LANDING_PAD.x });
    const outside = calculateLandingScoreBreakdown({ elapsed: 1000, fuelRemaining: -5, touchdownX: LANDING_PAD.x + 1000 });
    const left = calculateLandingScoreBreakdown({ elapsed: 30, fuelRemaining: 80, touchdownX: LANDING_PAD.x - 18 });
    const right = calculateLandingScoreBreakdown({ elapsed: 30, fuelRemaining: 80, touchdownX: LANDING_PAD.x + 18 });

    expect(centered.timeEfficiency).toBe(1);
    expect(centered.fuelEfficiency).toBe(1);
    expect(centered.accuracyEfficiency).toBe(1);
    expect(outside.timeEfficiency).toBe(0);
    expect(outside.fuelEfficiency).toBe(0);
    expect(outside.accuracyEfficiency).toBe(0);
    expect(left.accuracyEfficiency).toBe(right.accuracyEfficiency);
  });

  it('awards a safe landing score using the final simulation step', () => {
    const simulation = new Simulation();
    simulation.lander = {
      ...simulation.lander,
      x: LANDING_PAD.x - 1,
      y: LANDING_PAD.y + PHYSICS.landerHeight / 2 + 0.01,
      vx: 10,
      vy: 0,
      fuel: 80,
    };

    simulation.step({ throttle: 0, rotation: 0 }, 0.1);

    expect(simulation.status).toBe('landed');
    expect(simulation.lander.x).toBe(LANDING_PAD.x);
    expect(simulation.scoreBreakdown.elapsed).toBe(0.1);
    expect(simulation.scoreBreakdown.fuelRemaining).toBe(80);
    expect(simulation.score).toBe(calculateLandingScore({
      elapsed: 0.1,
      fuelRemaining: 80,
      touchdownX: simulation.lander.x,
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
    expect(crashed.scoreBreakdown).toBeNull();

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
    const breakdown = landed.scoreBreakdown;
    const elapsed = landed.elapsed;
    const fuel = landed.lander.fuel;
    landed.step({ throttle: 1, rotation: 1 });
    expect(landed.score).toBe(score);
    expect(landed.scoreBreakdown).toBe(breakdown);
    expect(landed.elapsed).toBe(elapsed);
    expect(landed.lander.fuel).toBe(fuel);
  });

  it('does not score a lost mission', () => {
    const simulation = new Simulation();
    simulation.lander.x = -31;

    simulation.step({ throttle: 0, rotation: 0 });

    expect(simulation.status).toBe('lost');
    expect(simulation.score).toBeNull();
    expect(simulation.scoreBreakdown).toBeNull();
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
    expect(simulation.scoreBreakdown).toBeNull();
    expect(simulation.trajectory).toEqual([]);
  });
});
