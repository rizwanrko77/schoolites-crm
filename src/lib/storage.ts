import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

// Singleton S3 client configured for Neon Object Storage
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Required for Neon S3-compatible custom endpoints
});

const BUCKET = process.env.AWS_BUCKET_NAME || 'storage-bucket';

/**
 * Uploads a file buffer into an asset-specific subfolder in Neon Object Storage.
 * Creates path: assets/{assetId}/{timestamp}-{cleanFileName}
 */
export async function uploadToStorage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  assetId?: string
): Promise<{ key: string }> {
  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = assetId ? `assets/${assetId}` : 'assets';
  const key = `${folder}/${Date.now()}-${cleanName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return { key };
}

/**
 * Deletes a single object from Neon Object Storage.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  if (!key) return;
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  } catch (err: any) {
    console.error(`Failed to delete object from storage [${key}]:`, err.message);
  }
}

/**
 * Deletes all objects within an asset's subfolder (e.g. assets/{assetId}/).
 */
export async function deleteAssetFolderFromStorage(assetId: string): Promise<void> {
  if (!assetId) return;
  try {
    const prefix = `assets/${assetId}/`;
    const listRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
      })
    );

    if (listRes.Contents && listRes.Contents.length > 0) {
      for (const obj of listRes.Contents) {
        if (obj.Key) {
          await deleteFromStorage(obj.Key);
        }
      }
    }
  } catch (err: any) {
    console.error(`Failed to delete asset folder [assets/${assetId}]:`, err.message);
  }
}

/**
 * Retrieves an object stream from Neon Object Storage.
 */
export async function getFromStorage(key: string) {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
  return res;
}
