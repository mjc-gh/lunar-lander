export const SAMPLE_PROGRAM = `// Your program runs once per flight-control cycle.
// rotation: -1 turns left, +1 turns right
// throttle: 0 is off, 1 is full thrust

function update(state) {
  // This keeps the lander upright and slows its fall, but it does
  // not steer toward the pad. Improve it to make a safe landing.
  const throttle = state.vy < -12 ? 0.65 : 0;
  const rotation = Math.max(
    -1,
    Math.min(1, -state.angle * 2 - state.angularVelocity),
  );

  return { throttle, rotation };
}`;
