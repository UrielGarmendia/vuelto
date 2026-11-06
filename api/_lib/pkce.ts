const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes as ArrayBuffer).toString('base64url');

export function verifier(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function challenge(v: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
}
