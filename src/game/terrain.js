export const WORLD = Object.freeze({ width: 1000, height: 720 });

export const LANDING_PAD = Object.freeze({
  left: 455,
  right: 575,
  y: 76,
  get x() {
    return (this.left + this.right) / 2;
  },
});

export const TERRAIN_POINTS = Object.freeze([
  { x: 0, y: 102 },
  { x: 70, y: 128 },
  { x: 145, y: 91 },
  { x: 225, y: 111 },
  { x: 310, y: 69 },
  { x: 390, y: 88 },
  { x: LANDING_PAD.left, y: LANDING_PAD.y },
  { x: LANDING_PAD.right, y: LANDING_PAD.y },
  { x: 650, y: 105 },
  { x: 730, y: 84 },
  { x: 810, y: 139 },
  { x: 890, y: 101 },
  { x: 1000, y: 122 },
]);

export function surfaceAt(x) {
  const boundedX = Math.max(0, Math.min(WORLD.width, x));
  for (let index = 1; index < TERRAIN_POINTS.length; index += 1) {
    const right = TERRAIN_POINTS[index];
    if (boundedX <= right.x) {
      const left = TERRAIN_POINTS[index - 1];
      const progress = (boundedX - left.x) / (right.x - left.x);
      return left.y + (right.y - left.y) * progress;
    }
  }
  return TERRAIN_POINTS.at(-1).y;
}

export function isOverPad(x, halfWidth = 0) {
  return x - halfWidth >= LANDING_PAD.left && x + halfWidth <= LANDING_PAD.right;
}
