import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { content, visibility } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Note content cannot be empty.' }, { status: 400 });
    }

    const validVisibility = ['personal', 'global'];
    const finalVisibility = validVisibility.includes(visibility) ? visibility : 'personal';

    const insertRes = await sql`
      INSERT INTO record_notes (record_type, record_id, author_id, visibility, content)
      VALUES ('lead', ${id}, ${user.id}, ${finalVisibility}, ${content.trim()})
      RETURNING id, author_id, visibility, content, created_at
    `;

    const note = insertRes[0];

    // Audit log
    try {
      await sql`
        INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
        VALUES ('lead', ${id}, ${user.id}, ${user.name}, 'note_added', ${JSON.stringify({
          visibility: finalVisibility,
          author_code: user.user_code,
        })})
      `;
    } catch (auditErr) {
      console.warn('Failed to write audit log for note:', auditErr);
    }

    return NextResponse.json({
      success: true,
      note: {
        ...note,
        author_name: user.name,
        author_code: user.user_code,
        author_role: user.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add note' }, { status: 500 });
  }
}
