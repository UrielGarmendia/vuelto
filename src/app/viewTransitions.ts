/**
 * WebKit engines (Safari, and every browser on iOS) take the Motion fade fallback instead.
 * Starting a view transition while the app boots or on back navigation crashed WebKit in
 * our test runs; Chromium never did, so it keeps the native transitions.
 */
export function isWebKitEngine(userAgent: string): boolean {
  return /AppleWebKit/.test(userAgent) && !/Chrome\/|Chromium\/|Edg\//.test(userAgent);
}

export const viewTransitions =
  typeof document !== 'undefined' &&
  'startViewTransition' in document &&
  !isWebKitEngine(navigator.userAgent);
