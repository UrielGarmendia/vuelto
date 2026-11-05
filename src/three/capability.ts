/**
 * Whether to show the 3D scenes. Falls back to 2D without WebGL, on low-end devices
 * (fewer than 4 cores or under 4 GB), or when motion should be reduced.
 */
export function canUse3D(reduceMotion: boolean): boolean {
  if (reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) < 4) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    // Release the probe context right away; browsers cap how many can be alive.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
