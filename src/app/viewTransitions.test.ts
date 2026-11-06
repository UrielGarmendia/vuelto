import { describe, expect, it } from 'vitest';
import { isWebKitEngine } from './viewTransitions';

const ua = {
  safariIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIOS:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('isWebKitEngine', () => {
  it('detects WebKit, including every iOS browser', () => {
    expect(isWebKitEngine(ua.safariIOS)).toBe(true);
    expect(isWebKitEngine(ua.chromeIOS)).toBe(true);
    expect(isWebKitEngine(ua.safariMac)).toBe(true);
  });
  it('leaves Chromium and Gecko browsers out', () => {
    expect(isWebKitEngine(ua.chromeAndroid)).toBe(false);
    expect(isWebKitEngine(ua.chromeWindows)).toBe(false);
    expect(isWebKitEngine(ua.edge)).toBe(false);
    expect(isWebKitEngine(ua.firefox)).toBe(false);
  });
});
