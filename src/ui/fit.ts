/** Font size that fits `text` in the hole of the ring (about 45 % of its width). */
export const holeFontSize = (text: string, max = 20) =>
  `min(${max}px, ${(42 / (text.length * 0.66)).toFixed(2)}cqw)`;
