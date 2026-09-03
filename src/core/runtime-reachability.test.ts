import { describe, expect, it } from 'vitest';
import { canReachRuntime } from './runtime-reachability';

describe('canReachRuntime', () => {
  it('lets an https: client reach an https: runtime', () => {
    expect(canReachRuntime('https://paper-camp.vercel.app', 'https://deimos.ts.net:3941')).toBe(
      true,
    );
  });

  it('blocks an https: client from an http: runtime on a non-loopback host', () => {
    expect(canReachRuntime('https://paper-camp.vercel.app', 'http://deimos.ts.net:3941')).toBe(
      false,
    );
  });

  it('lets an http: client reach an http: runtime', () => {
    expect(canReachRuntime('http://localhost:5173', 'http://deimos.ts.net:3941')).toBe(true);
  });

  it('lets an http: client reach an https: runtime', () => {
    expect(canReachRuntime('http://localhost:5173', 'https://deimos.ts.net:3941')).toBe(true);
  });

  it('always allows an http: runtime on localhost, even from an https: client', () => {
    expect(canReachRuntime('https://paper-camp.vercel.app', 'http://localhost:3941')).toBe(true);
  });

  it('always allows an http: runtime on 127.0.0.1, even from an https: client', () => {
    expect(canReachRuntime('https://paper-camp.vercel.app', 'http://127.0.0.1:3941')).toBe(true);
  });

  it('always allows an http: runtime on the IPv6 loopback, even from an https: client', () => {
    expect(canReachRuntime('https://paper-camp.vercel.app', 'http://[::1]:3941')).toBe(true);
  });
});
