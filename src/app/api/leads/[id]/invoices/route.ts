import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { syncInvoicePayouts } from '@/lib/payouts';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'business_relations') {
      return NextResponse.json({ error: 'Access denied: Only Admin and Business Relations can manage invoices.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Verify contract exists for this lead
    const contractCheck = await sql`
      SELECT id FROM lead_contracts WHERE lead_id = ${id} LIMIT 1
    `;
    if (contractCheck.length === 0) {
      return NextResponse.json({ error: 'Contract not found. Please setup the contract first.' }, { status: 400 });
    }

    const contractId = contractCheck[0].id;
    const amount = parseFloat(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invoice amount must be greater than zero.' }, { status: 400 });
    }

    const invoiceNumber = body.invoice_number ? String(body.invoice_number).trim() : '';
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required.' }, { status: 400 });
    }

    const raiseDate = body.raise_date || new Date().toISOString().split('T')[0];
    const dueDate = body.due_date || null;
    const status = ['raised', 'pending', 'cleared', 'cancelled'].includes(body.status)
      ? body.status
      : 'raised';
    if (status === 'cleared' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only an administrator can mark an invoice as cleared.' },
        { status: 403 }
      );
    }
    const notes = body.notes ? String(body.notes).trim() : null;
    const paymentMethod = body.payment_method ? String(body.payment_method).trim() : null;
    const paymentReference = body.payment_reference ? String(body.payment_reference).trim() : null;
    const clearedAt = status === 'cleared' ? (body.cleared_at || new Date().toISOString()) : null;

    const invoiceRes = await sql`
      INSERT INTO contract_invoices (
        contract_id, lead_id, invoice_number, amount, raise_date, due_date, status, cleared_at, payment_method, payment_reference, notes, updated_at
      )
      VALUES (
        ${contractId}, ${id}, ${invoiceNumber}, ${amount}, ${raiseDate}, ${dueDate}, ${status}, ${clearedAt}, ${paymentMethod}, ${paymentReference}, ${notes}, NOW()
      )
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
        'INVOICE_CREATED',
        ${JSON.stringify({
          invoice_number: invoiceNumber,
          amount,
          raise_date: raiseDate,
          status,
          due_date: dueDate,
        })}
      )
    `;

    // Sync actor commission payouts
    await syncInvoicePayouts(invoiceRes[0].id);

    return NextResponse.json({
      success: true,
      invoice: invoiceRes[0],
      message: 'Invoice created successfully.',
    });
  } catch (err: any) {
    console.error('Error creating invoice:', err);
    return NextResponse.json({ error: err.message || 'Failed to create invoice' }, { status: 500 });
  }
}
