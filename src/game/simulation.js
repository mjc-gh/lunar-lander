import { PHYSICS, clamp, integrateLander, normalizeAngle } from './physics.js';
import { LANDING_PAD, WORLD, isOverPad, surfaceAt } from './terrain.js';

export const STEP_SECONDS = 1 / 60;
export const LANDING_LIMITS = Object.freeze({ verticalSpeed: 14, horizontalSpeed: 10, angle: 8 });
export const INITIAL_FUEL = 100;
export const SCORING = Object.freeze({ maxScore: 10_000, parTimeSeconds: 120, timeWeight: 0.5, fuelWeight: 0.5 });

export function initialLander() {
  return {
    x: 245,
    y: 610,
    vx: 18,
    vy: -8,
    angle: 0.08,
    angularVelocity: 0,
    fuel: INITIAL_FUEL,
    throttle: 0,
  };
}

export function calculateLandingScore({ elapsed, fuelRemaining, initialFuel = INITIAL_FUEL }) {
  const timeEfficiency = clamp(1 - elapsed / SCORING.parTimeSeconds, 0, 1);
  const fuelEfficiency = initialFuel > 0 ? clamp(fuelRemaining / initialFuel, 0, 1) : 0;
  return Math.round(
    SCORING.maxScore *
      (SCORING.timeWeight * timeEfficiency + SCORING.fuelWeight * fuelEfficiency),
  );
}

export function classifyContact(lander) {
  const angleDegrees = Math.abs((normalizeAngle(lander.angle) * 180) / Math.PI);
  const safe =
    isOverPad(lander.x, PHYSICS.landerWidth / 2) &&
    Math.abs(lander.vy) <= LANDING_LIMITS.verticalSpeed &&
    Math.abs(lander.vx) <= LANDING_LIMITS.horizontalSpeed &&
    angleDegrees <= LANDING_LIMITS.angle;
  return safe ? 'landed' : 'crashed';
}

export class Simulation {
  constructor() {
    this.reset();
  }

  reset() {
    this.lander = initialLander();
    this.elapsed = 0;
    this.status = 'idle';
    this.initialFuel = INITIAL_FUEL;
    this.score = null;
    this.trajectory = [];
  }

  start() {
    if (this.status === 'idle') this.status = 'running';
  }

  telemetry() {
    const terrainY = surfaceAt(this.lander.x);
    return Object.freeze({
      x: this.lander.x,
      y: this.lander.y,
      vx: this.lander.vx,
      vy: this.lander.vy,
      angle: this.lander.angle,
      angularVelocity: this.lander.angularVelocity,
      altitude: Math.max(0, this.lander.y - PHYSICS.landerHeight / 2 - terrainY),
      fuel: this.lander.fuel,
      elapsed: this.elapsed,
      gravity: PHYSICS.gravity,
      maxThrust: PHYSICS.thrustAcceleration,
      pad: Object.freeze({ x: LANDING_PAD.x, y: LANDING_PAD.y }),
      limits: LANDING_LIMITS,
    });
  }

  step(controls, dt = STEP_SECONDS) {
    if (!['idle', 'running'].includes(this.status)) return this.status;
    this.status = 'running';
    this.lander = integrateLander(this.lander, controls, dt);
    this.elapsed += dt;

    if (this.trajectory.length === 0 || this.elapsed - this.trajectory.at(-1).time >= 0.2) {
      this.trajectory.push({ x: this.lander.x, y: this.lander.y, time: this.elapsed });
      if (this.trajectory.length > 160) this.trajectory.shift();
    }

    const footY = this.lander.y - PHYSICS.landerHeight / 2;
    if (footY <= surfaceAt(this.lander.x)) {
      this.status = classifyContact(this.lander);
      if (this.status === 'landed') {
        this.score = calculateLandingScore({
          elapsed: this.elapsed,
          fuelRemaining: this.lander.fuel,
          initialFuel: this.initialFuel,
        });
      }
      this.lander.y = surfaceAt(this.lander.x) + PHYSICS.landerHeight / 2;
      this.lander.throttle = 0;
    } else if (this.lander.x < -30 || this.lander.x > WORLD.width + 30 || this.lander.y > WORLD.height + 100) {
      this.status = 'lost';
      this.lander.throttle = 0;
    }

    return this.status;
  }
}
