import { describe, expect, it } from 'vitest';
import { LANDING_PAD, isOverPad, surfaceAt } from './terrain.js';

describe('terrain queries', () => {
  it('interpolates the surface between points', () => {
    expect(surfaceAt(35)).toBe(115);
  });

  it('keeps the landing pad flat', () => {
    expect(surfaceAt(LANDING_PAD.left)).toBe(LANDING_PAD.y);
    expect(surfaceAt(LANDING_PAD.x)).toBe(LANDING_PAD.y);
    expect(surfaceAt(LANDING_PAD.right)).toBe(LANDING_PAD.y);
  });

  it('accounts for the lander width over the pad', () => {
    expect(isOverPad(LANDING_PAD.x, 12)).toBe(true);
    expect(isOverPad(LANDING_PAD.left, 12)).toBe(false);
  });
});
