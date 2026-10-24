import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const { id: payoutId } = await params;
    const body = await req.json();

    const existingRes = await sql`
      SELECT * FROM actor_commission_payouts WHERE id = ${payoutId} LIMIT 1
    `;
    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Payout record not found.' }, { status: 404 });
    }
    const current = existingRes[0];

    const payoutStatus = body.payout_status === 'paid' ? 'paid' : 'pending';
    let paidAt = current.paid_at;
    if (payoutStatus === 'paid') {
      paidAt = body.paid_at || new Date().toISOString();
    } else {
      paidAt = null;
    }

    const paymentMethod = body.payment_method !== undefined
      ? (body.payment_method ? String(body.payment_method).trim() : null)
      : (payoutStatus === 'paid' ? current.payment_method : null);

    const paymentReference = body.payment_reference !== undefined
      ? (body.payment_reference ? String(body.payment_reference).trim() : null)
      : (payoutStatus === 'paid' ? current.payment_reference : null);

    const notes = body.notes !== undefined
      ? (body.notes ? String(body.notes).trim() : null)
      : current.notes;

    const updatedRes = await sql`
      UPDATE actor_commission_payouts
      SET
        payout_status = ${payoutStatus},
        paid_at = ${paidAt},
        payment_method = ${paymentMethod},
        payment_reference = ${paymentReference},
        notes = ${notes},
        updated_by = ${user.id},
        updated_at = NOW()
      WHERE id = ${payoutId}
      RETURNING *
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES (
        'user',
        ${current.user_id},
        ${user.id},
        ${user.name},
        'ACTOR_PAYOUT_STATUS_UPDATED',
        ${JSON.stringify({
          payout_id: payoutId,
          invoice_id: current.invoice_id,
          actor_role: current.actor_role,
          payout_amount: current.payout_amount,
          previous_status: current.payout_status,
          new_status: payoutStatus,
          payment_reference: paymentReference,
          payment_method: paymentMethod,
        })}
      )
    `;

    return NextResponse.json({
      success: true,
      payout: updatedRes[0],
      message: payoutStatus === 'paid' ? 'Commission marked as Disbursed / Paid.' : 'Commission marked as Pending.',
    });
  } catch (err: any) {
    console.error('Error updating payout status:', err);
    return NextResponse.json({ error: err.message || 'Failed to update payout' }, { status: 500 });
  }
}
