import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    // 1. Variables
    const variables = await sql`
      SELECT id, key, label, sort_order, created_at
      FROM pricing_variables
      ORDER BY sort_order ASC, created_at ASC
    `;

    // 2. Active template
    const templates = await sql`
      SELECT id, title, content, is_active, updated_at
      FROM pricing_templates
      WHERE is_active = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    // 3. Country rate matrix
    const rates = await sql`
      SELECT id, country, data, updated_at
      FROM pricing_country_rates
      ORDER BY country ASC
    `;

    return NextResponse.json({
      variables,
      template: templates[0] || null,
      rates,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch admin pricing data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ACTION 1: Add new variable
    if (action === 'add_variable') {
      let { key, label } = body;
      if (!key || !label) {
        return NextResponse.json({ error: 'Both variable key and display label are required.' }, { status: 400 });
      }

      // Sanitize key to lowercase identifier: letters, numbers, underscores
      const sanitizedKey = key
        .trim()
        .toLowerCase()
        .replace(/[{}]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/__+/g, '_')
        .replace(/^_+|_+$/g, '');

      if (!sanitizedKey) {
        return NextResponse.json({ error: 'Invalid variable key.' }, { status: 400 });
      }

      // Get highest sort order
      const maxOrderRes = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM pricing_variables`;
      const nextOrder = maxOrderRes[0]?.next_order || 1;

      const inserted = await sql`
        INSERT INTO pricing_variables (key, label, sort_order)
        VALUES (${sanitizedKey}, ${label.trim()}, ${nextOrder})
        ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label
        RETURNING id, key, label, sort_order
      `;

      return NextResponse.json({ success: true, variable: inserted[0] });
    }

    // ACTION 2: Delete variable
    if (action === 'delete_variable') {
      const { key } = body;
      if (!key) {
        return NextResponse.json({ error: 'Variable key is required.' }, { status: 400 });
      }

      if (key === 'country') {
        return NextResponse.json({ error: 'The "country" variable is the primary lookup key and cannot be deleted.' }, { status: 400 });
      }

      await sql`DELETE FROM pricing_variables WHERE key = ${key}`;
      return NextResponse.json({ success: true, deletedKey: key });
    }

    // ACTION 3: Save template
    if (action === 'save_template') {
      const { title, content } = body;
      if (!content || typeof content !== 'string') {
        return NextResponse.json({ error: 'Template content cannot be empty.' }, { status: 400 });
      }

      const existing = await sql`SELECT id FROM pricing_templates WHERE is_active = TRUE LIMIT 1`;

      let savedTemplate;
      if (existing.length > 0) {
        const updated = await sql`
          UPDATE pricing_templates
          SET title = ${title || 'Standard Pricing Template'},
              content = ${content},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
          RETURNING id, title, content, updated_at
        `;
        savedTemplate = updated[0];
      } else {
        const inserted = await sql`
          INSERT INTO pricing_templates (title, content, is_active)
          VALUES (${title || 'Standard Pricing Template'}, ${content}, TRUE)
          RETURNING id, title, content, updated_at
        `;
        savedTemplate = inserted[0];
      }

      return NextResponse.json({ success: true, template: savedTemplate });
    }

    // ACTION 4: Save / Sync Matrix Rows (From Direct In-Table Editing, Spreadsheet Paste, or CSV Upload)
    if (action === 'save_matrix' || action === 'upload_matrix') {
      const { rows, syncAll } = body;
      if (!Array.isArray(rows)) {
        return NextResponse.json({ error: 'No data rows provided.' }, { status: 400 });
      }

      let insertedCount = 0;
      let updatedCount = 0;
      const validCountries: string[] = [];

      for (const row of rows) {
        const country = row.country?.trim();
        if (!country) continue;
        validCountries.push(country);

        // Upsert into pricing_country_rates
        const result = await sql`
          INSERT INTO pricing_country_rates (country, data, updated_at)
          VALUES (${country}, ${JSON.stringify(row)}, NOW())
          ON CONFLICT (country) DO UPDATE
          SET data = EXCLUDED.data,
              updated_at = NOW()
          RETURNING (xmax = 0) AS was_inserted
        `;

        if (result[0]?.was_inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      }

      // If syncAll is true, remove deleted country rows from database
      if (syncAll && validCountries.length > 0) {
        await sql`DELETE FROM pricing_country_rates WHERE NOT (country = ANY(${validCountries}))`;
      }

      return NextResponse.json({
        success: true,
        summary: {
          totalRows: validCountries.length,
          inserted: insertedCount,
          updated: updatedCount,
        },
      });
    }

    // ACTION 5: Save single country row
    if (action === 'save_row') {
      const { country, data } = body;
      if (!country || !country.trim()) {
        return NextResponse.json({ error: 'Country name is required.' }, { status: 400 });
      }

      const cleanCountry = country.trim();
      const rowData = { ...data, country: cleanCountry };

      const result = await sql`
        INSERT INTO pricing_country_rates (country, data, updated_at)
        VALUES (${cleanCountry}, ${JSON.stringify(rowData)}, NOW())
        ON CONFLICT (country) DO UPDATE
        SET data = EXCLUDED.data,
            updated_at = NOW()
        RETURNING id, country, data, updated_at
      `;

      return NextResponse.json({ success: true, row: result[0] });
    }

    // ACTION 6: Delete single country row
    if (action === 'delete_row') {
      const { country } = body;
      if (!country) {
        return NextResponse.json({ error: 'Country is required to delete.' }, { status: 400 });
      }

      await sql`DELETE FROM pricing_country_rates WHERE country = ${country}`;
      return NextResponse.json({ success: true, deletedCountry: country });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process admin pricing action' }, { status: 500 });
  }
}
