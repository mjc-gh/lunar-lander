export const PHYSICS = Object.freeze({
  gravity: 14,
  thrustAcceleration: 30,
  rotationAcceleration: 2.4,
  angularDamping: 0.75,
  fuelBurnRate: 4.5,
  landerWidth: 24,
  landerHeight: 34,
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function sanitizeControls(controls) {
  return {
    throttle: clamp(controls?.throttle, 0, 1),
    rotation: clamp(controls?.rotation, -1, 1),
  };
}

export function integrateLander(lander, rawControls, dt) {
  const controls = sanitizeControls(rawControls);
  const throttle = lander.fuel > 0 ? controls.throttle : 0;
  const fuelUsed = Math.min(lander.fuel, throttle * PHYSICS.fuelBurnRate * dt);
  const effectiveThrottle = throttle > 0 ? fuelUsed / (PHYSICS.fuelBurnRate * dt) : 0;
  const angularVelocity =
    (lander.angularVelocity + controls.rotation * PHYSICS.rotationAcceleration * dt) *
    Math.exp(-PHYSICS.angularDamping * dt);
  const angle = normalizeAngle(lander.angle + angularVelocity * dt);
  const acceleration = effectiveThrottle * PHYSICS.thrustAcceleration;
  const vx = lander.vx + Math.sin(angle) * acceleration * dt;
  const vy = lander.vy + (Math.cos(angle) * acceleration - PHYSICS.gravity) * dt;

  return {
    ...lander,
    x: lander.x + vx * dt,
    y: lander.y + vy * dt,
    vx,
    vy,
    angle,
    angularVelocity,
    fuel: Math.max(0, lander.fuel - fuelUsed),
    throttle: effectiveThrottle,
  };
}
