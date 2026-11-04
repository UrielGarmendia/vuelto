import { expect, it } from 'vitest';
import { palette } from '../../ui/icons';
import { textOn } from './kinds';

const contrast = (a: string, b: string) => {
  const L = (h: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

it('picks readable text on every palette color and the seeded card black', () => {
  for (const hex of [...palette.map((p) => p.hex), '#1C1A17']) {
    // Large text on cards (balance ≥ 24px bold, name 17px semibold) needs 3:1; aim for AA 4.5 where possible.
    expect(contrast(hex, textOn(hex)), hex).toBeGreaterThanOrEqual(3);
  }
  expect(textOn('#D6A933')).toBe('#1C1A17');
  expect(textOn('#1C1A17')).toBe('#FFFFFF');
});
