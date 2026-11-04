import { expect, it } from 'vitest';
import { spring } from './motion';

it('animated money never overshoots (spring is at least critically damped)', () => {
  const { stiffness, damping } = spring.number;
  expect(damping).toBeGreaterThanOrEqual(2 * Math.sqrt(stiffness));
});
