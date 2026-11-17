import { db as defaultDb, type VueltoDB } from '../../db/db';

/** Keeps a receipt photo on this device and returns its id for `receiptBlobId`. */
export async function keepPhoto(photo: Blob, db: VueltoDB = defaultDb): Promise<string> {
  const id = crypto.randomUUID();
  await db.blobs.add({ id, bytes: await photo.arrayBuffer(), type: photo.type });
  return id;
}
