import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { query, city, country = 'India', countryCode = 'IN', areas = '', apiKey } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Please enter a search keyword (e.g. CBSE Schools, Play School).' }, { status: 400 });
    }

    if (!city || !city.trim()) {
      return NextResponse.json({ error: 'Please specify a city (e.g. Mumbai, Pune, Delhi).' }, { status: 400 });
    }

    const activeApiKey = apiKey?.trim() || process.env.GOOGLE_PLACES_API_KEY;
    if (!activeApiKey) {
      return NextResponse.json({
        error: 'No Google Places API Key configured on server. Please ensure GOOGLE_PLACES_API_KEY is configured in .env.local.',
        needsApiKey: true,
      }, { status: 400 });
    }

    // Support searching multiple comma-separated areas or a single search
    const areaList = areas
      ? areas.split(',').map((a: string) => a.trim()).filter(Boolean)
      : [''];

    let totalFetched = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedNoPhoneCount = 0;

    const resolvedRegionCode = (countryCode || 'IN').trim().toUpperCase();

    for (const area of areaList) {
      const fullSearchQuery = [
        query.trim(),
        area ? `in ${area}` : '',
        city.trim(),
        country.trim(),
      ].filter(Boolean).join(', ');

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': activeApiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.formattedAddress,places.addressComponents,places.googleMapsUri,places.businessStatus,places.regularOpeningHours,places.primaryType',
        },
        body: JSON.stringify({
          textQuery: fullSearchQuery,
          regionCode: resolvedRegionCode,
          languageCode: 'en',
          maxResultCount: 20,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Google Places API error:', errText);
        throw new Error(`Google Places API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const places = data.places || [];
      totalFetched += places.length;

      for (const p of places) {
        const placeId = p.id;
        const name = p.displayName?.text || '';
        const primaryPhone = p.internationalPhoneNumber || p.nationalPhoneNumber || '';
        const alternativePhone = p.nationalPhoneNumber && p.nationalPhoneNumber !== primaryPhone ? p.nationalPhoneNumber : null;

        // Skip permanently closed businesses
        if (p.businessStatus === 'CLOSED_PERMANENTLY') {
          continue;
        }

        // MANDATORY: Must have a phone number
        if (!primaryPhone && !alternativePhone) {
          skippedNoPhoneCount++;
          continue;
        }

        // Extract address components
        let postalCode: string | null = null;
        let state: string | null = null;
        let locality: string | null = null;

        if (Array.isArray(p.addressComponents)) {
          for (const comp of p.addressComponents) {
            const types = comp.types || [];
            if (types.includes('postal_code')) postalCode = comp.longText;
            if (types.includes('administrative_area_level_1')) state = comp.longText;
            if (types.includes('locality') || types.includes('sublocality_level_1')) locality = comp.longText;
          }
        }

        const formattedAddress = p.formattedAddress || '';
        const website = p.websiteUri || null;
        const mapsUrl = p.googleMapsUri || null;
        const rating = p.rating ? parseFloat(String(p.rating)) : null;
        const ratingCount = p.userRatingCount ? parseInt(String(p.userRatingCount), 10) : 0;
        const primaryType = p.primaryType || (p.types && p.types[0]) || 'school';
        const typeTags = p.types || [primaryType];
        const businessStatus = p.businessStatus || 'OPERATIONAL';
        const openingHours = p.regularOpeningHours || {};

        const existing = await sql`
          SELECT id, place_id, status 
          FROM db_businesses 
          WHERE place_id = ${placeId} 
          LIMIT 1;
        `;

        if (existing.length === 0) {
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
              raw_payload
            ) VALUES (
              ${placeId},
              ${name},
              ${primaryPhone},
              ${alternativePhone},
              ${website},
              ${mapsUrl},
              ${rating},
              ${ratingCount},
              ${primaryType},
              ${JSON.stringify(typeTags)},
              ${formattedAddress},
              ${formattedAddress},
              ${locality || area || null},
              ${city.trim()},
              ${state},
              ${postalCode},
              ${country.trim()},
              ${businessStatus},
              ${JSON.stringify(openingHours)},
              ${query.trim()},
              ${city.trim()},
              ${area || null},
              'fresh',
              ${JSON.stringify(p)}
            )
            RETURNING id;
          `;

          insertedCount++;

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
              ${`Discovered via Google Places API New search by ${currentUser.name}`},
              ${JSON.stringify({ source: 'places_api', query, city, area })}
            );
          `;
        } else {
          // If already exists, update metadata only
          await sql`
            UPDATE db_businesses
            SET
              name = ${name},
              primary_phone = COALESCE(primary_phone, ${primaryPhone}),
              alternative_phone = COALESCE(alternative_phone, ${alternativePhone}),
              website = COALESCE(website, ${website}),
              maps_url = COALESCE(maps_url, ${mapsUrl}),
              rating = COALESCE(${rating}, rating),
              rating_count = GREATEST(rating_count, ${ratingCount}),
              formatted_address = COALESCE(formatted_address, ${formattedAddress}),
              area = COALESCE(area, ${locality || area || null}),
              city = COALESCE(city, ${city.trim()}),
              state = COALESCE(state, ${state}),
              postal_code = COALESCE(postal_code, ${postalCode}),
              business_status = ${businessStatus},
              search_keyword = COALESCE(search_keyword, ${query.trim()}),
              search_city = COALESCE(search_city, ${city.trim()}),
              search_area = COALESCE(search_area, ${area || null}),
              updated_at = NOW()
            WHERE place_id = ${placeId};
          `;

          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalFetched,
        insertedCount,
        updatedCount,
        skippedNoPhoneCount,
      },
      message: `Search completed: ${insertedCount} new fresh prospects found with contact numbers, ${updatedCount} updated, ${skippedNoPhoneCount} skipped (no phone number).`,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/places/search-api:', err);
    return NextResponse.json({ error: err.message || 'Places API search failed' }, { status: 500 });
  }
}
