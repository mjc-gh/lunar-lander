# Lander Lab

A browser-based lunar lander where the flight controls are written in JavaScript. The game uses Vite, Canvas 2D, and a Web Worker that isolates guidance code from the rendering loop.

## Run locally

```bash
bun install
bun run dev
```

Vite prints the local URL when it starts. The project also works with `npm` when Node.js is installed.

## Guidance API

Define a synchronous `update` function in the in-browser editor:

```js
function update(state) {
  return {
    throttle: 0.5, // 0 to 1
    rotation: 0,   // -1 to 1
  };
}
```

The state object contains:

| Property | Meaning |
| --- | --- |
| `x`, `y` | Lander position in meters |
| `vx`, `vy` | Horizontal and vertical velocity in meters per second |
| `angle` | Rotation in radians; zero is upright |
| `angularVelocity` | Rotation speed in radians per second |
| `altitude` | Distance from the lander feet to the surface |
| `fuel` | Fuel remaining, from 0 to 100 |
| `elapsed` | Mission time in seconds |
| `gravity`, `maxThrust` | Current environment physics |
| `pad.x`, `pad.y` | Center and elevation of the landing pad |
| `limits` | Safe landing thresholds |

Player code is run in a disposable worker and terminated when an update exceeds 100 ms. This prevents accidental infinite loops from freezing the page, but it is not a hardened sandbox for hostile third-party code.

## Scoring

Only safe landings receive a score. Scores range from 0 to 10,000 and weight simulated mission time and remaining fuel equally. With `elapsed` measured in seconds and `fuel` measured against the mission's initial fuel, the score is:

```text
round(10,000 * (0.5 * clamp(1 - elapsed / 120, 0, 1) + 0.5 * clamp(fuel / initialFuel, 0, 1)))
```

The 120-second par applies to simulated time, not wall-clock time. Pausing and changing the display clock speed do not directly change the score.

## Checks

```bash
bun run test
bun run build
```
