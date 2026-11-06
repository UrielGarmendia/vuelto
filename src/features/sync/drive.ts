/** The few Drive v3 calls sync needs, all inside the app's private appDataFolder. */

export interface DriveFile {
  id: string;
  name: string;
  /** Increases on every change; used to notice another device writing in between. */
  version: string;
}

/** The access token expired or was revoked: ask for a new one and retry. */
export class AuthError extends Error {}
export class DriveError extends Error {}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function driveClient(token: string, fetcher: typeof fetch = fetch) {
  async function call(url: string, init: RequestInit = {}) {
    const res = await fetcher(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (res.status === 401) throw new AuthError(`Drive ${res.status}`);
    if (!res.ok) throw new DriveError(`Drive ${res.status}`);
    return res;
  }

  return {
    async list(): Promise<DriveFile[]> {
      const q = new URLSearchParams({
        spaces: 'appDataFolder',
        fields: 'files(id,name,version)',
        pageSize: '1000',
      });
      const body = (await (await call(`${API}?${q}`)).json()) as { files?: DriveFile[] };
      return body.files ?? [];
    },

    async read(id: string): Promise<unknown> {
      return (await call(`${API}/${id}?alt=media`)).json();
    },

    async version(id: string): Promise<string> {
      const body = (await (await call(`${API}/${id}?fields=version`)).json()) as DriveFile;
      return body.version;
    },

    async create(name: string, content: unknown): Promise<DriveFile> {
      const boundary = `vuelto-${crypto.randomUUID()}`;
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify({ name, parents: ['appDataFolder'] }),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        JSON.stringify(content),
        `--${boundary}--`,
      ].join('\r\n');
      const res = await call(`${UPLOAD}?uploadType=multipart&fields=id,name,version`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      return (await res.json()) as DriveFile;
    },

    async update(id: string, content: unknown): Promise<DriveFile> {
      const res = await call(`${UPLOAD}/${id}?uploadType=media&fields=id,name,version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      return (await res.json()) as DriveFile;
    },
  };
}

export type Drive = ReturnType<typeof driveClient>;
