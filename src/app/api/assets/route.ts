import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { uploadToStorage } from '@/lib/storage';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_IMAGES_COUNT = 5; // Up to 5 images per asset

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const fileType = searchParams.get('type');

    let query;
    if (user.role === 'admin') {
      query = await sql`
        SELECT id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
        FROM assets
        ORDER BY created_at DESC
      `;
    } else {
      query = await sql`
        SELECT id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
        FROM assets
        WHERE is_active = TRUE
        ORDER BY created_at DESC
      `;
    }

    let assets = query;
    if (category && category !== 'all') {
      assets = assets.filter((a: any) => a.category === category);
    }
    if (fileType && fileType !== 'all') {
      assets = assets.filter((a: any) => a.file_type === fileType);
    }

    return NextResponse.json({ assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';

    let title = '';
    let category = 'general';
    let fileType = 'image';
    let bodyText = '';
    let contentUrl = '';
    let storageKey: string | null = null;
    let description: string | null = null;
    let filesData: Array<{ url: string; storage_key: string; name: string; size: number; mime_type: string }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = (formData.get('title') as string) || '';
      category = (formData.get('category') as string) || 'general';
      fileType = (formData.get('file_type') as string) || 'image';
      bodyText = (formData.get('body_text') as string) || '';
      description = (formData.get('description') as string) || null;

      if (!title.trim()) {
        return NextResponse.json({ error: 'Asset title is required.' }, { status: 400 });
      }

      const assetId = crypto.randomUUID();

      if (fileType === 'image') {
        const files = formData.getAll('files') as File[];
        const singleFile = formData.get('file') as File | null;

        const allFiles: File[] = [];
        if (files && files.length > 0) {
          allFiles.push(...files.filter((f) => f && f.size > 0));
        } else if (singleFile && singleFile.size > 0) {
          allFiles.push(singleFile);
        }

        if (allFiles.length === 0) {
          return NextResponse.json({ error: 'Please select at least 1 image to upload (up to 5).' }, { status: 400 });
        }

        if (allFiles.length > MAX_IMAGES_COUNT) {
          return NextResponse.json({ error: `Maximum ${MAX_IMAGES_COUNT} images allowed per asset.` }, { status: 400 });
        }

        for (const file of allFiles) {
          if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Limit is 5MB per image.` },
              { status: 400 }
            );
          }
          if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: `"${file.name}" is not a valid image format.` }, { status: 400 });
          }
        }

        // Upload all images into the asset's subfolder in Neon Object Storage
        for (let i = 0; i < allFiles.length; i++) {
          const file = allFiles[i];
          const buffer = Buffer.from(await file.arrayBuffer());
          const uploadRes = await uploadToStorage(buffer, file.name, file.type || 'image/png', assetId);
          filesData.push({
            url: `/api/assets/${assetId}/file?index=${i}`,
            storage_key: uploadRes.key,
            name: file.name,
            size: file.size,
            mime_type: file.type,
          });
        }

        storageKey = filesData[0].storage_key;
        contentUrl = `/api/assets/${assetId}/file`;

        const [newAsset] = await sql`
          INSERT INTO assets (id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_by)
          VALUES (${assetId}, ${title.trim()}, ${category}, ${fileType}, ${contentUrl}, ${bodyText.trim() || null}, ${storageKey}, ${JSON.stringify(filesData)}::jsonb, ${description?.trim() || null}, TRUE, ${user.id})
          RETURNING id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
        `;

        await logAudit(newAsset.id, user, 'asset_created', {
          title: newAsset.title,
          file_type: newAsset.file_type,
          files_count: filesData.length,
          folder: `assets/${assetId}`,
        });

        return NextResponse.json({ success: true, asset: newAsset });
      } else if (fileType === 'pdf') {
        const file = formData.get('file') as File | null;
        if (!file || file.size === 0) {
          return NextResponse.json({ error: 'Please select a PDF document to upload.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: `PDF file size exceeds 5MB (${(file.size / (1024 * 1024)).toFixed(2)}MB).` },
            { status: 400 }
          );
        }

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          return NextResponse.json({ error: 'Selected file is not a valid PDF document.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadResult = await uploadToStorage(buffer, file.name, 'application/pdf', assetId);
        storageKey = uploadResult.key;
        contentUrl = `/api/assets/${assetId}/file`;

        filesData = [
          {
            url: contentUrl,
            storage_key: storageKey,
            name: file.name,
            size: file.size,
            mime_type: 'application/pdf',
          },
        ];

        const [newAsset] = await sql`
          INSERT INTO assets (id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_by)
          VALUES (${assetId}, ${title.trim()}, ${category}, ${fileType}, ${contentUrl}, ${bodyText.trim() || null}, ${storageKey}, ${JSON.stringify(filesData)}::jsonb, ${description?.trim() || null}, TRUE, ${user.id})
          RETURNING id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
        `;

        await logAudit(newAsset.id, user, 'asset_created', {
          title: newAsset.title,
          file_type: newAsset.file_type,
          storage_key: storageKey,
        });

        return NextResponse.json({ success: true, asset: newAsset });
      } else {
        contentUrl = (formData.get('content_url') as string) || '';
      }
    } else {
      // JSON body (for text / video links)
      const body = await req.json();
      title = body.title || '';
      category = body.category || 'general';
      fileType = body.file_type || 'text';
      bodyText = body.body_text || '';
      contentUrl = body.content_url || '';
      description = body.description || null;
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Asset title is required.' }, { status: 400 });
    }

    if (fileType === 'video_link' && (!contentUrl || !contentUrl.trim())) {
      return NextResponse.json({ error: 'Video link URL is required.' }, { status: 400 });
    }

    if (fileType === 'text' && (!bodyText || !bodyText.trim())) {
      return NextResponse.json({ error: 'Pitch template body text is required.' }, { status: 400 });
    }

    const [newAsset] = await sql`
      INSERT INTO assets (title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_by)
      VALUES (${title.trim()}, ${category}, ${fileType}, ${contentUrl.trim()}, ${bodyText.trim() || null}, ${storageKey}, '[]'::jsonb, ${description?.trim() || null}, TRUE, ${user.id})
      RETURNING id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
    `;

    await logAudit(newAsset.id, user, 'asset_created', {
      title: newAsset.title,
      file_type: newAsset.file_type,
      category: newAsset.category,
    });

    return NextResponse.json({ success: true, asset: newAsset });
  } catch (err: any) {
    console.error('Error creating asset:', err);
    return NextResponse.json({ error: err.message || 'Failed to create asset' }, { status: 500 });
  }
}

async function logAudit(recordId: string, user: any, action: string, metadata: any) {
  try {
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES ('asset', ${recordId}, ${user.id}, ${user.name}, ${action}, ${JSON.stringify(metadata)})
    `;
  } catch (e) {
    console.warn('Audit log write error:', e);
  }
}
