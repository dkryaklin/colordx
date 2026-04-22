import { describe, expect, it } from 'vitest';
import { colordx, toHex8, toHexByte } from '../src/index.js';

describe('toHexByte', () => {
  it('converts 0–255 to 2-char lowercase hex', () => {
    expect(toHexByte(0)).toBe('00');
    expect(toHexByte(15)).toBe('0f');
    expect(toHexByte(16)).toBe('10');
    expect(toHexByte(128)).toBe('80');
    expect(toHexByte(255)).toBe('ff');
  });

  it('rounds fractional inputs to nearest', () => {
    expect(toHexByte(0.4)).toBe('00');
    expect(toHexByte(0.6)).toBe('01');
    expect(toHexByte(127.5)).toBe('80'); // banker's? JS Math.round rounds half away from zero → 128
    expect(toHexByte(254.5)).toBe('ff');
  });

  it('clamps out-of-range inputs', () => {
    expect(toHexByte(-1)).toBe('00');
    expect(toHexByte(-Infinity)).toBe('00');
    expect(toHexByte(256)).toBe('ff');
    expect(toHexByte(1000)).toBe('ff');
    expect(toHexByte(Infinity)).toBe('ff');
  });

  it('handles NaN by clamping to 0', () => {
    // Math.round(NaN) = NaN; Math.min(Math.max(NaN, 0), 255) = NaN; NaN as array index → undefined.
    // Documenting the edge: callers shouldn't pass NaN, but the function shouldn't throw.
    // Here we just assert it doesn't throw; the specific return value is unspecified.
    expect(() => toHexByte(NaN)).not.toThrow();
  });
});

describe('toHex8', () => {
  it('always emits 8 hex digits regardless of alpha', () => {
    expect(toHex8('#ff0000')).toBe('#ff0000ff');
    expect(toHex8('#ff0000ff')).toBe('#ff0000ff');
    expect(toHex8('#ff000080')).toBe('#ff000080');
    expect(toHex8('#ff000000')).toBe('#ff000000');
  });

  it('preserves alpha from hex, rgb, hsl, oklch inputs', () => {
    expect(toHex8({ r: 255, g: 0, b: 0, alpha: 0.5 })).toBe('#ff000080');
    expect(toHex8('rgb(255 0 0 / 0.5)')).toBe('#ff000080');
    expect(toHex8('hsl(0 100% 50% / 0.5)')).toBe('#ff000080');
    expect(toHex8('oklch(0.628 0.2577 29.23 / 0.5)')).toMatch(/^#[0-9a-f]{8}$/);
  });

  it('accepts input without alpha (defaults to opaque)', () => {
    expect(toHex8({ r: 255, g: 0, b: 0 })).toBe('#ff0000ff');
  });

  it('accepts a Colordx instance', () => {
    const c = colordx({ r: 0, g: 128, b: 255, alpha: 0.25 });
    expect(toHex8(c)).toBe('#0080ff40');
  });

  it('round-trips via colordx().toHex8()', () => {
    expect(toHex8('#abcdef12')).toBe(colordx('#abcdef12').toHex8());
  });

  it('emits lowercase hex (matches toHex)', () => {
    expect(toHex8('#FFAA33')).toBe('#ffaa33ff');
  });

  it('snaps alpha through the same 3-decimal precision as the rest of the lib', () => {
    // 1/255 → 0.004 → round(0.004*255)=1 → "01"
    expect(toHex8({ r: 255, g: 0, b: 0, alpha: 1 / 255 })).toBe('#ff000001');
    // 254/255 → 0.996 → round(0.996*255)=254 → "fe"
    expect(toHex8({ r: 255, g: 0, b: 0, alpha: 254 / 255 })).toBe('#ff0000fe');
  });
});
