const KEY = 'vuelto-onboarded';

// Storage can throw (private mode, blocked site data); then we just show onboarding again.
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Not persisted: onboarding shows again next launch, which is harmless.
  }
}
