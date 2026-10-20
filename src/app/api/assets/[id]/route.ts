import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { uploadToStorage, deleteAssetFolderFromStorage, deleteFromStorage } from '@/lib/storage';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_COUNT = 5;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await sql`
      SELECT id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active
      FROM assets
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }

    const contentType = req.headers.get('content-type') || '';

    let title = existing.title;
    let category = existing.category;
    let description = existing.description;
    let bodyText = existing.body_text;
    let contentUrl = existing.content_url;
    let storageKey = existing.storage_key;
    let filesData = Array.isArray(existing.files) ? existing.files : [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      if (formData.has('title')) title = (formData.get('title') as string) || '';
      if (formData.has('category')) category = (formData.get('category') as string) || 'general';
      if (formData.has('description')) description = (formData.get('description') as string) || null;
      if (formData.has('body_text')) bodyText = (formData.get('body_text') as string) || null;

      if (existing.file_type === 'image') {
        const files = formData.getAll('files') as File[];
        const singleFile = formData.get('file') as File | null;

        const newFiles: File[] = [];
        if (files && files.length > 0) {
          newFiles.push(...files.filter((f) => f && f.size > 0));
        } else if (singleFile && singleFile.size > 0) {
          newFiles.push(singleFile);
        }

        if (newFiles.length > 0) {
          if (newFiles.length > MAX_IMAGES_COUNT) {
            return NextResponse.json({ error: `Maximum ${MAX_IMAGES_COUNT} images allowed per asset.` }, { status: 400 });
          }

          for (const file of newFiles) {
            if (file.size > MAX_FILE_SIZE) {
              return NextResponse.json(
                { error: `"${file.name}" exceeds 5MB limit.` },
                { status: 400 }
              );
            }
            if (!file.type.startsWith('image/')) {
              return NextResponse.json({ error: `"${file.name}" is not an image.` }, { status: 400 });
            }
          }

          // Clean up old files in asset's folder
          await deleteAssetFolderFromStorage(id);

          // Upload new files to assets/{id}/
          filesData = [];
          for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            const buffer = Buffer.from(await file.arrayBuffer());
            const uploadRes = await uploadToStorage(buffer, file.name, file.type || 'image/png', id);
            filesData.push({
              url: `/api/assets/${id}/file?index=${i}`,
              storage_key: uploadRes.key,
              name: file.name,
              size: file.size,
              mime_type: file.type,
            });
          }

          storageKey = filesData[0].storage_key;
          contentUrl = `/api/assets/${id}/file`;
        }
      } else if (existing.file_type === 'pdf') {
        const file = formData.get('file') as File | null;
        if (file && file.size > 0) {
          if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: `PDF file size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).` },
              { status: 400 }
            );
          }

          if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Selected file is not a PDF.' }, { status: 400 });
          }

          await deleteAssetFolderFromStorage(id);

          const buffer = Buffer.from(await file.arrayBuffer());
          const uploadRes = await uploadToStorage(buffer, file.name, 'application/pdf', id);
          storageKey = uploadRes.key;
          contentUrl = `/api/assets/${id}/file`;
          filesData = [{
            url: contentUrl,
            storage_key: storageKey,
            name: file.name,
            size: file.size,
            mime_type: 'application/pdf',
          }];
        }
      } else if (formData.has('content_url')) {
        contentUrl = (formData.get('content_url') as string) || contentUrl;
      }
    } else {
      const body = await req.json();
      if (body.title !== undefined) title = body.title;
      if (body.category !== undefined) category = body.category;
      if (body.description !== undefined) description = body.description;
      if (body.body_text !== undefined) bodyText = body.body_text;
      if (body.content_url !== undefined) contentUrl = body.content_url;
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Asset title cannot be empty.' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE assets
      SET 
        title = ${title.trim()},
        category = ${category},
        description = ${description ? description.trim() : null},
        body_text = ${bodyText ? bodyText.trim() : null},
        content_url = ${contentUrl},
        storage_key = ${storageKey},
        files = ${JSON.stringify(filesData)}::jsonb
      WHERE id = ${id}
      RETURNING id, title, category, file_type, content_url, body_text, storage_key, files, description, is_active, created_at
    `;

    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('asset', ${id}, ${user.id}, ${user.name}, 'asset_updated', ${JSON.stringify({
          title: updated.title,
          category: updated.category,
        })})
      `;
    } catch (e) {
      console.warn('Audit log write error:', e);
    }

    return NextResponse.json({ success: true, asset: updated });
  } catch (err: any) {
    console.error('Error updating asset:', err);
    return NextResponse.json({ error: err.message || 'Failed to update asset' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    const [existing] = await sql`
      SELECT id, title, file_type, storage_key, files
      FROM assets
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!existing) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }

    // 1. Permanently delete the asset subfolder and all its files from Neon Object Storage
    await deleteAssetFolderFromStorage(id);

    // In case storage_key was outside the subfolder (legacy fallback)
    if (existing.storage_key) {
      await deleteFromStorage(existing.storage_key);
    }

    // 2. Delete database record
    await sql`DELETE FROM assets WHERE id = ${id}`;

    // 3. Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('asset', ${id}, ${user.id}, ${user.name}, 'asset_deleted', ${JSON.stringify({
          title: existing.title,
          file_type: existing.file_type,
          folder: `assets/${id}/`,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for asset deletion:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'Asset and folder permanently purged from storage.' });
  } catch (err: any) {
    console.error('Error deleting asset:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete asset' }, { status: 500 });
  }
}
