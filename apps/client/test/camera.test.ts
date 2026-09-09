import { describe, expect, it } from 'vitest';
import { cameraLayout, clampCamera, edgeVelocity, panCamera, screenToWorld, worldToScreen, followCamera } from '../src/prototype/camera';

const viewport = { width: 800, height: 400, scale: 4.5 };
const bounds = { left: 0, top: -100, right: 400, bottom: 225 };

describe('camera geometry', () => {
  it('keeps machine scale across viewport and map sizes within the same layout class', () => {
    expect(cameraLayout(844, 390).cell).toBe(9);
    expect(cameraLayout(667, 375).cell).toBe(9);
    expect(cameraLayout(1440, 900).cell).toBe(9);
  });
  it('round trips points without changing simulation coordinates', () => {
    const center = { x: 200.25, y: 80.5 };
    const point = { x: 213.125, y: -15.75 };
    expect(screenToWorld(worldToScreen(point, center, viewport), center, viewport)).toEqual(point);
  });
  it('clamps all boundaries and centers maps smaller than the viewport', () => {
    expect(clampCamera({ x: -100, y: -200 }, viewport, bounds)).toEqual({ x: 800 / 9, y: -100 + 400 / 9 });
    expect(clampCamera({ x: 900, y: 900 }, viewport, bounds)).toEqual({ x: 400 - 800 / 9, y: 225 - 400 / 9 });
    expect(clampCamera({ x: 100, y: 100 }, { width: 2000, height: 2000, scale: 4 }, { left: 0, top: 0, right: 100, bottom: 100 })).toEqual({ x: 50, y: 50 });
  });
  it('moves the world with the finger, not the tank', () => {
    expect(panCamera({ x: 200, y: 80 }, { x: 45, y: -45 }, viewport, bounds)).toEqual({ x: 190, y: 90 });
  });
  it('uses a dead zone and preserves the camera when the actor remains inside', () => {
    const center = { x: 200, y: 80 };
    expect(followCamera(center, { x: 205, y: 85 }, viewport, bounds)).toEqual(center);
    expect(followCamera(center, { x: 280, y: 80 }, viewport, bounds).x).toBeGreaterThan(200);
  });
});

describe('edge scrolling', () => {
  it('stops away from the edge and outside the viewport', () => {
    expect(edgeVelocity({ x: 400, y: 200 }, viewport)).toEqual({ x: 0, y: 0 });
    expect(edgeVelocity({ x: -1, y: 200 }, viewport)).toEqual({ x: 0, y: 0 });
  });
  it('accelerates near the edge without faster diagonal movement', () => {
    expect(edgeVelocity({ x: 0, y: 200 }, viewport)).toEqual({ x: -480, y: 0 });
    expect(edgeVelocity({ x: 12, y: 200 }, viewport).x).toBe(-240);
    const v = edgeVelocity({ x: 0, y: 0 }, viewport);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(480);
  });
});
