import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { syncInvoicePayouts } from '@/lib/payouts';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'business_relations') {
      return NextResponse.json({ error: 'Access denied: Only Admin and Business Relations can update invoices.' }, { status: 403 });
    }

    const { id, invoiceId } = await params;
    const body = await req.json();

    // Verify invoice exists
    const existingRes = await sql`
      SELECT * FROM contract_invoices WHERE id = ${invoiceId} AND lead_id = ${id} LIMIT 1
    `;
    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }
    const currentInvoice = existingRes[0];

    const amount = body.amount !== undefined ? parseFloat(body.amount) : currentInvoice.amount;
    const invoiceNumber = body.invoice_number !== undefined ? String(body.invoice_number).trim() : currentInvoice.invoice_number;
    const raiseDate = body.raise_date !== undefined ? body.raise_date : currentInvoice.raise_date;
    const dueDate = body.due_date !== undefined ? body.due_date : currentInvoice.due_date;
    const status = body.status !== undefined && ['raised', 'pending', 'cleared', 'cancelled'].includes(body.status)
      ? body.status
      : currentInvoice.status;

    if (user.role !== 'admin' && (status === 'cleared' || currentInvoice.status === 'cleared')) {
      return NextResponse.json(
        { error: 'Only an administrator can clear an invoice or change a cleared invoice.' },
        { status: 403 }
      );
    }
    
    let clearedAt = currentInvoice.cleared_at;
    if (status === 'cleared' && !currentInvoice.cleared_at) {
      clearedAt = body.cleared_at || new Date().toISOString();
    } else if (status !== 'cleared') {
      clearedAt = null;
    }

    const paymentMethod = body.payment_method !== undefined ? (body.payment_method ? String(body.payment_method).trim() : null) : currentInvoice.payment_method;
    const paymentReference = body.payment_reference !== undefined ? (body.payment_reference ? String(body.payment_reference).trim() : null) : currentInvoice.payment_reference;
    const notes = body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : currentInvoice.notes;

    const updatedRes = await sql`
      UPDATE contract_invoices
      SET
        amount = ${amount},
        invoice_number = ${invoiceNumber},
        raise_date = ${raiseDate},
        due_date = ${dueDate},
        status = ${status},
        cleared_at = ${clearedAt},
        payment_method = ${paymentMethod},
        payment_reference = ${paymentReference},
        notes = ${notes},
        updated_at = NOW()
      WHERE id = ${invoiceId} AND lead_id = ${id}
      RETURNING *
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES (
        'lead',
        ${id},
        ${user.id},
        ${user.name},
        ${status === 'cleared' && currentInvoice.status !== 'cleared' ? 'INVOICE_CLEARED' : 'INVOICE_UPDATED'},
        ${JSON.stringify({
          invoice_id: invoiceId,
          invoice_number: invoiceNumber,
          amount,
          status,
          cleared_at: clearedAt,
          payment_reference: paymentReference,
        })}
      )
    `;

    // Sync actor commission payouts
    await syncInvoicePayouts(invoiceId);

    return NextResponse.json({
      success: true,
      invoice: updatedRes[0],
      message: status === 'cleared' ? 'Invoice marked as cleared / collected.' : 'Invoice updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating invoice:', err);
    return NextResponse.json({ error: err.message || 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'business_relations') {
      return NextResponse.json({ error: 'Access denied: Only Admin and Business Relations can delete invoices.' }, { status: 403 });
    }

    const { id, invoiceId } = await params;

    const existingRes = await sql`
      SELECT * FROM contract_invoices WHERE id = ${invoiceId} AND lead_id = ${id} LIMIT 1
    `;
    if (existingRes.length === 0) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    if (existingRes[0].status === 'cleared' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only an administrator can delete a cleared invoice.' },
        { status: 403 }
      );
    }

    await sql`
      DELETE FROM contract_invoices WHERE id = ${invoiceId} AND lead_id = ${id}
    `;

    // Audit log
    await sql`
      INSERT INTO audit_logs (record_type, record_id, actor_id, actor_name, action, metadata)
      VALUES (
        'lead',
        ${id},
        ${user.id},
        ${user.name},
        'INVOICE_DELETED',
        ${JSON.stringify({
          invoice_id: invoiceId,
          invoice_number: existingRes[0].invoice_number,
          amount: existingRes[0].amount,
        })}
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully.',
    });
  } catch (err: any) {
    console.error('Error deleting invoice:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete invoice' }, { status: 500 });
  }
}
