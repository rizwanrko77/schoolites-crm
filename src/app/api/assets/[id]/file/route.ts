import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getFromStorage } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const indexParam = searchParams.get('index');
    const isDownload = searchParams.get('download') === 'true';

    const [asset] = await sql`
      SELECT id, title, file_type, content_url, storage_key, files, is_active
      FROM assets
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!asset || (!asset.is_active && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    let targetKey = asset.storage_key;
    let targetFileName = asset.title;

    // Check if asset has multiple files stored in JSONB
    const filesArray = Array.isArray(asset.files) ? asset.files : [];
    if (filesArray.length > 0) {
      const idx = indexParam ? parseInt(indexParam, 10) : 0;
      const selected = filesArray[isNaN(idx) ? 0 : Math.min(Math.max(0, idx), filesArray.length - 1)];
      if (selected && selected.storage_key) {
        targetKey = selected.storage_key;
        targetFileName = selected.name || asset.title;
      }
    }

    // Stream from Neon Object Storage if key is present
    if (targetKey) {
      const s3Obj = await getFromStorage(targetKey);

      if (!s3Obj.Body) {
        return NextResponse.json({ error: 'File content unavailable' }, { status: 404 });
      }

      const stream = s3Obj.Body.transformToWebStream();
      const headers = new Headers();
      headers.set('Content-Type', s3Obj.ContentType || (asset.file_type === 'pdf' ? 'application/pdf' : 'image/png'));
      
      const disposition = isDownload ? 'attachment' : 'inline';
      headers.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(targetFileName)}"`);
      
      if (s3Obj.ContentLength) {
        headers.set('Content-Length', s3Obj.ContentLength.toString());
      }
      headers.set('Cache-Control', 'public, max-age=3600');

      return new NextResponse(stream as any, {
        status: 200,
        headers,
      });
    }

    // If external URL (video or external link)
    if (asset.content_url && (asset.content_url.startsWith('http://') || asset.content_url.startsWith('https://'))) {
      return NextResponse.redirect(asset.content_url);
    }

    return NextResponse.json({ error: 'Direct file not available' }, { status: 400 });
  } catch (err: any) {
    console.error('Error serving asset file:', err);
    return NextResponse.json({ error: err.message || 'Failed to serve asset file' }, { status: 500 });
  }
}
