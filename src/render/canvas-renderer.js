import { PHYSICS } from '../game/physics.js';
import { LANDING_PAD, TERRAIN_POINTS, WORLD } from '../game/terrain.js';

const STARS = Array.from({ length: 85 }, (_, index) => ({
  x: ((index * 89 + 31) % 997) / 997,
  y: ((index * 47 + 17) % 701) / 701,
  radius: index % 9 === 0 ? 1.4 : 0.7,
  alpha: 0.22 + ((index * 13) % 50) / 100,
}));

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  }

  toScreen(x, y) {
    return {
      x: (x / WORLD.width) * this.width,
      y: this.height - (y / WORLD.height) * this.height,
    };
  }

  render(simulation) {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.drawSky(context);
    this.drawTrajectory(context, simulation.trajectory);
    this.drawTerrain(context);
    this.drawLander(context, simulation.lander, simulation.status);
  }

  drawSky(context) {
    const gradient = context.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#080b12');
    gradient.addColorStop(0.68, '#101722');
    gradient.addColorStop(1, '#1a2228');
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.width, this.height);

    context.fillStyle = '#d8e7e7';
    for (const star of STARS) {
      context.globalAlpha = star.alpha;
      context.beginPath();
      context.arc(star.x * this.width, star.y * this.height * 0.78, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    const earth = this.toScreen(830, 595);
    const glow = context.createRadialGradient(earth.x, earth.y, 2, earth.x, earth.y, 34);
    glow.addColorStop(0, 'rgba(190, 226, 235, .8)');
    glow.addColorStop(0.35, 'rgba(95, 153, 180, .35)');
    glow.addColorStop(1, 'rgba(95, 153, 180, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(earth.x, earth.y, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#b8d5dc';
    context.beginPath();
    context.arc(earth.x, earth.y, 8, 0, Math.PI * 2);
    context.fill();
  }

  drawTerrain(context) {
    context.beginPath();
    const first = this.toScreen(TERRAIN_POINTS[0].x, TERRAIN_POINTS[0].y);
    context.moveTo(first.x, first.y);
    for (const point of TERRAIN_POINTS.slice(1)) {
      const screen = this.toScreen(point.x, point.y);
      context.lineTo(screen.x, screen.y);
    }
    context.lineTo(this.width, this.height);
    context.lineTo(0, this.height);
    context.closePath();

    const ground = context.createLinearGradient(0, this.height * 0.78, 0, this.height);
    ground.addColorStop(0, '#72746f');
    ground.addColorStop(0.12, '#414641');
    ground.addColorStop(1, '#222925');
    context.fillStyle = ground;
    context.fill();
    context.strokeStyle = '#a6aaa0';
    context.lineWidth = 1;
    context.stroke();

    const left = this.toScreen(LANDING_PAD.left, LANDING_PAD.y + 2);
    const right = this.toScreen(LANDING_PAD.right, LANDING_PAD.y + 2);
    context.save();
    context.strokeStyle = '#d8ff5a';
    context.shadowColor = '#d8ff5a';
    context.shadowBlur = 9;
    context.lineWidth = 3;
    context.setLineDash([9, 6]);
    context.beginPath();
    context.moveTo(left.x, left.y);
    context.lineTo(right.x, right.y);
    context.stroke();
    context.restore();

    context.fillStyle = 'rgba(216, 255, 90, .8)';
    context.font = '10px IBM Plex Mono, monospace';
    context.textAlign = 'center';
    context.fillText('LANDING ZONE', (left.x + right.x) / 2, left.y + 19);
  }

  drawTrajectory(context, trajectory) {
    if (trajectory.length < 2) return;
    context.save();
    context.strokeStyle = 'rgba(117, 226, 215, .28)';
    context.lineWidth = 1;
    context.setLineDash([3, 7]);
    context.beginPath();
    trajectory.forEach((point, index) => {
      const screen = this.toScreen(point.x, point.y);
      if (index === 0) context.moveTo(screen.x, screen.y);
      else context.lineTo(screen.x, screen.y);
    });
    context.stroke();
    context.restore();
  }

  drawLander(context, lander, status) {
    const center = this.toScreen(lander.x, lander.y);
    const scale = this.width / WORLD.width;
    const width = Math.max(14, PHYSICS.landerWidth * scale);
    const height = Math.max(20, PHYSICS.landerHeight * (this.height / WORLD.height));

    context.save();
    context.translate(center.x, center.y);
    context.rotate(lander.angle);

    if (lander.throttle > 0 && status === 'running') {
      const flameLength = height * (0.38 + lander.throttle * 0.65);
      const flame = context.createLinearGradient(0, height * 0.4, 0, height * 0.4 + flameLength);
      flame.addColorStop(0, '#f7f0bd');
      flame.addColorStop(0.35, '#f6a43a');
      flame.addColorStop(1, 'rgba(244, 86, 31, 0)');
      context.fillStyle = flame;
      context.beginPath();
      context.moveTo(-width * 0.2, height * 0.36);
      context.lineTo(0, height * 0.42 + flameLength);
      context.lineTo(width * 0.2, height * 0.36);
      context.fill();
    }

    context.strokeStyle = status === 'crashed' ? '#ff6b50' : '#dce5de';
    context.fillStyle = '#202b2d';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-width * 0.42, height * 0.14);
    context.lineTo(-width * 0.27, -height * 0.35);
    context.lineTo(0, -height * 0.5);
    context.lineTo(width * 0.27, -height * 0.35);
    context.lineTo(width * 0.42, height * 0.14);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = '#8ec9c7';
    context.beginPath();
    context.arc(0, -height * 0.18, width * 0.13, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.moveTo(-width * 0.28, height * 0.08);
    context.lineTo(-width * 0.58, height * 0.48);
    context.lineTo(-width * 0.78, height * 0.48);
    context.moveTo(width * 0.28, height * 0.08);
    context.lineTo(width * 0.58, height * 0.48);
    context.lineTo(width * 0.78, height * 0.48);
    context.stroke();
    context.restore();
  }
}
