import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './index';

describe('describeUserAgent', () => {
  it('summarises a desktop Chrome on Windows string', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 152 · Windows · Desktop');
  });

  it('summarises Safari on iPhone as a mobile device', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 17 · iOS · Mobile');
  });

  it('summarises Firefox on macOS', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/128.0',
      ),
    ).toBe('Firefox 128 · macOS 10.15.7 · Desktop');
  });

  it('summarises Edge ahead of the Chrome token it also carries', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      ),
    ).toBe('Edge 151 · Windows · Desktop');
  });

  it('leaves an already human-friendly label untouched', () => {
    expect(describeUserAgent('Chrome on Windows')).toBe('Chrome on Windows');
  });

  it('handles missing or unknown values', () => {
    expect(describeUserAgent('')).toBe('Unknown device');
    expect(describeUserAgent(null)).toBe('Unknown device');
    expect(describeUserAgent('Unknown browser')).toBe('Unknown device');
  });
});
