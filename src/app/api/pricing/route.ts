import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch active template
    const templates = await sql`
      SELECT id, title, content, updated_at
      FROM pricing_templates
      WHERE is_active = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const template = templates[0] || null;

    // 2. Fetch all defined variables
    const variables = await sql`
      SELECT id, key, label, sort_order
      FROM pricing_variables
      ORDER BY sort_order ASC, created_at ASC
    `;

    // 3. Fetch all country rate rows
    const ratesRows = await sql`
      SELECT id, country, data, updated_at
      FROM pricing_country_rates
      ORDER BY country ASC
    `;

    // Map by country for O(1) instant client lookup
    const countryMap: Record<string, any> = {};
    const countriesList: string[] = [];

    for (const row of ratesRows) {
      countryMap[row.country] = {
        id: row.id,
        country: row.country,
        data: row.data,
        updated_at: row.updated_at,
      };
      countriesList.push(row.country);
    }

    return NextResponse.json({
      template,
      variables,
      countries: countriesList,
      countryRates: countryMap,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch pricing information' },
      { status: 500 }
    );
  }
}
