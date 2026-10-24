import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

/**
 * Auto-detects delimiter: tab (\t), comma (,), or semicolon (;)
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

/**
 * Robust CSV/TSV parser that handles commas, tabs, quotes, and newlines
 */
function parseCsv(csvText: string): Array<Record<string, string>> {
  const delimiter = detectDelimiter(csvText);
  const lines: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field.trim());
        field = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        row.push(field.trim());
        if (row.some((cell) => cell.length > 0)) {
          lines.push(row);
        }
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  // Final field if any
  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z0-9_]/g, ''));
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] !== undefined ? values[index] : '';
    });
    records.push(record);
  }

  return records;
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    let rawRecords: any[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (Array.isArray(body.records)) {
        rawRecords = body.records;
      } else if (typeof body.csv === 'string') {
        rawRecords = parseCsv(body.csv);
      } else {
        return NextResponse.json({ error: 'Expected records array or csv text in JSON payload' }, { status: 400 });
      }
    } else {
      const text = await req.text();
      rawRecords = parseCsv(text);
    }

    if (rawRecords.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found in the CSV import.' }, { status: 400 });
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedNoPhoneCount = 0;
    let skippedInvalidCount = 0;

    for (const r of rawRecords) {
      // Find matching keys with standard aliases
      const placeId = (
        r.place_id ||
        r.id ||
        r.google_place_id ||
        r.placeid ||
        ''
      ).trim();

      const name = (
        r.institution_name ||
        r.name ||
        r.institution ||
        r.school_name ||
        r.displayname ||
        r.display_name ||
        ''
      ).trim();

      const primaryPhone = (
        r.primary_phone ||
        r.phone ||
        r.international_phone_number ||
        r.internationalphonenumber ||
        r.national_phone_number ||
        r.nationalphonenumber ||
        r.contact_number ||
        r.mobile ||
        ''
      ).trim();

      const alternativePhone = (
        r.alternative_phone ||
        r.alt_phone ||
        r.secondary_phone ||
        (r.nationalphonenumber && r.nationalphonenumber !== primaryPhone ? r.nationalphonenumber : '') ||
        ''
      ).trim();

      // Mandatory validation: Must have placeId, name, and at least one phone
      if (!placeId || !name) {
        skippedInvalidCount++;
        continue;
      }

      if (!primaryPhone && !alternativePhone) {
        skippedNoPhoneCount++;
        continue;
      }

      const website = (r.website || r.website_uri || r.websiteuri || '').trim() || null;
      const mapsUrl = (r.maps_url || r.google_maps_uri || r.googlemapsuri || '').trim() || null;
      const rating = r.rating ? parseFloat(r.rating) || null : null;
      const ratingCount = r.rating_count || r.ratingcount || r.user_rating_count || r.userratingcount
        ? parseInt(r.rating_count || r.ratingcount || r.user_rating_count || r.userratingcount, 10) || 0
        : 0;

      const primaryType = (r.primary_type || r.primary_type_code || r.primarytype || r.primarytypecode || 'school').trim();
      let typeTags: any[] = [];
      if (r.type_tags || r.types) {
        try {
          const val = r.type_tags || r.types;
          typeTags = typeof val === 'string' && val.startsWith('[') ? JSON.parse(val) : String(val).split(',').map(s => s.trim()).filter(Boolean);
        } catch {
          typeTags = [primaryType];
        }
      }

      const streetAddress = (r.street_address || r.streetaddress || r.formatted_address || r.formattedaddress || '').trim() || null;
      const area = (r.area || r.locality || r.sublocality || '').trim() || null;
      const city = (r.city || r.search_city || '').trim() || null;
      const state = (r.state || '').trim() || null;
      const postalCode = (r.postal_code || r.postalcode || r.pincode || r.pin_code || '').trim() || null;
      const country = (r.country || 'India').trim();
      const businessStatus = (r.business_status || r.businessstatus || 'OPERATIONAL').trim();

      let regularOpeningHours = {};
      if (r.regular_opening_hours || r.regularopeninghours) {
        try {
          const hoursVal = r.regular_opening_hours || r.regularopeninghours;
          regularOpeningHours = typeof hoursVal === 'string' && (hoursVal.startsWith('{') || hoursVal.startsWith('['))
            ? JSON.parse(hoursVal)
            : { raw: hoursVal };
        } catch {
          regularOpeningHours = { raw: r.regular_opening_hours || r.regularopeninghours };
        }
      }

      const searchKeyword = (r.search_keyword || r.keyword || '').trim() || null;
      const searchCity = (r.search_city || city || '').trim() || null;
      const searchArea = (r.search_area || area || '').trim() || null;

      // Extract existing notes, status, and checked_at from sheet
      const sheetNotes = (r.notes || r.internal_notes || '').trim() || null;
      const rawStatus = (r.contact_status || r.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
      const rawCheckedAt = (r.checked_at || r.last_contacted_at || '').trim();

      let initialStatus = 'fresh';
      const validStatuses = ['new', 'rnr', 'switched_off', 'interested', 'contact_later', 'not_interested', 'following_up', 'converted_to_lead'];
      if (validStatuses.includes(rawStatus)) {
        initialStatus = rawStatus;
      } else if (rawStatus === 'callback' || rawStatus === 'call_back') {
        initialStatus = 'contact_later';
      }

      let checkedAtTimestamp: string | null = null;
      if (rawCheckedAt) {
        try {
          const parsed = new Date(rawCheckedAt);
          if (!isNaN(parsed.getTime())) {
            checkedAtTimestamp = parsed.toISOString();
          }
        } catch {}
      }

      // Check if place already exists
      const existing = await sql`
        SELECT id, place_id, status, assigned_to_user_id 
        FROM db_businesses 
        WHERE place_id = ${placeId} 
        LIMIT 1;
      `;

      if (existing.length === 0) {
        // Insert new record
        const insertRes = await sql`
          INSERT INTO db_businesses (
            place_id,
            name,
            primary_phone,
            alternative_phone,
            website,
            maps_url,
            rating,
            rating_count,
            primary_type,
            type_tags,
            formatted_address,
            street_address,
            area,
            city,
            state,
            postal_code,
            country,
            business_status,
            regular_opening_hours,
            search_keyword,
            search_city,
            search_area,
            status,
            notes,
            last_contacted_at,
            raw_payload
          ) VALUES (
            ${placeId},
            ${name},
            ${primaryPhone || alternativePhone},
            ${alternativePhone || null},
            ${website},
            ${mapsUrl},
            ${rating},
            ${ratingCount},
            ${primaryType},
            ${JSON.stringify(typeTags)},
            ${streetAddress},
            ${streetAddress},
            ${area},
            ${city},
            ${state},
            ${postalCode},
            ${country},
            ${businessStatus},
            ${JSON.stringify(regularOpeningHours)},
            ${searchKeyword},
            ${searchCity},
            ${searchArea},
            ${initialStatus},
            ${sheetNotes},
            ${checkedAtTimestamp},
            ${JSON.stringify(r)}
          )
          RETURNING id;
        `;

        insertedCount++;

        // Audit log
        await sql`
          INSERT INTO db_place_history (
            place_id,
            business_id,
            actor_id,
            action,
            old_status,
            new_status,
            notes,
            metadata
          ) VALUES (
            ${placeId},
            ${insertRes[0].id},
            ${currentUser.id},
            'imported',
            NULL,
            'fresh',
            ${`Imported from CSV by ${currentUser.name}`},
            ${JSON.stringify({ source: 'csv_import', search_city: searchCity, search_keyword: searchKeyword })}
          );
        `;
      } else {
        // If existing record is fresh or unassigned, update metadata
        // If it is already assigned or worked on, do NOT overwrite its status or assigned user!
        const curr = existing[0];
        const isFresh = curr.status === 'fresh' || curr.status === 'unassigned';

        await sql`
          UPDATE db_businesses
          SET
            name = ${name},
            primary_phone = COALESCE(primary_phone, ${primaryPhone || alternativePhone}),
            alternative_phone = COALESCE(alternative_phone, ${alternativePhone || null}),
            website = COALESCE(website, ${website}),
            maps_url = COALESCE(maps_url, ${mapsUrl}),
            rating = COALESCE(${rating}, rating),
            rating_count = GREATEST(rating_count, ${ratingCount}),
            formatted_address = COALESCE(formatted_address, ${streetAddress}),
            street_address = COALESCE(street_address, ${streetAddress}),
            area = COALESCE(area, ${area}),
            city = COALESCE(city, ${city}),
            state = COALESCE(state, ${state}),
            postal_code = COALESCE(postal_code, ${postalCode}),
            country = COALESCE(country, ${country}),
            business_status = ${businessStatus},
            search_keyword = COALESCE(search_keyword, ${searchKeyword}),
            search_city = COALESCE(search_city, ${searchCity}),
            search_area = COALESCE(search_area, ${searchArea}),
            updated_at = NOW()
          WHERE id = ${curr.id};
        `;

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: rawRecords.length,
        insertedCount,
        updatedCount,
        skippedNoPhoneCount,
        skippedInvalidCount,
      },
      message: `Import processed: ${insertedCount} new fresh records added, ${updatedCount} existing records updated, ${skippedNoPhoneCount} skipped (no phone number).`,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/places/import:', err);
    return NextResponse.json({ error: err.message || 'Failed to import CSV' }, { status: 500 });
  }
}
