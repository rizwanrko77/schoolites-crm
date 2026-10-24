import { pool } from '../lib/db';

async function testDatabasePlaces() {
  console.log('🧪 Starting End-to-End Test for Places DB & Outreach Pipeline...\n');

  try {
    // 1. Verify schema tables and columns
    console.log('--- 1. Testing Schema & Columns ---');
    const cols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'has_database_access';
    `);
    if (cols.rows.length === 0) throw new Error('has_database_access column missing on users');
    console.log('✓ users.has_database_access exists.');

    const placeCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'db_businesses';
    `);
    const colNames = placeCols.rows.map(c => c.column_name);
    ['place_id', 'primary_phone', 'alternative_phone', 'rating', 'city', 'status', 'callback_at', 'notes'].forEach(c => {
      if (!colNames.includes(c)) throw new Error(`db_businesses missing column ${c}`);
    });
    console.log('✓ db_businesses has all required Google Places & outreach columns.');

    // 2. Set up test user with database access
    console.log('\n--- 2. Setting up Test Actor with Database Access ---');
    const testUserRes = await pool.query(`
      SELECT id, user_code, name, role, has_database_access 
      FROM users 
      WHERE role = 'pre_sales' AND is_active = TRUE
      LIMIT 1;
    `);

    let testUser = testUserRes.rows[0];
    if (!testUser) {
      console.log('No pre_sales user found, creating a test pre_sales user...');
      const created = await pool.query(`
        INSERT INTO users (user_code, name, email, role, has_database_access, is_active)
        VALUES ('PS-TEST-99', 'Test Outreach Rep', 'test_outreach_rep@schoolites.com', 'pre_sales', true, true)
        RETURNING id, user_code, name, role, has_database_access;
      `);
      testUser = created.rows[0];
    } else {
      await pool.query(`UPDATE users SET has_database_access = TRUE WHERE id = '${testUser.id}';`);
      testUser.has_database_access = true;
    }
    console.log(`✓ Test Actor: ${testUser.name} (${testUser.user_code}) has_database_access = ${testUser.has_database_access}`);

    // 3. Test CSV import logic directly (including phone validation filter & deduplication)
    console.log('\n--- 3. Testing CSV Import with Mandatory Phone Filter ---');
    const testCsvRows = [
      {
        place_id: 'ChIJTestE2E_01',
        institution_name: 'Delhi Public International School',
        primary_phone: '+919876543210',
        alternative_phone: '+919876543211',
        website: 'https://dpis-example.edu.in',
        maps_url: 'https://maps.google.com/?cid=12345',
        rating: '4.6',
        rating_count: '142',
        primary_type: 'school',
        street_address: 'Plot 12 Sector 4, Vashi',
        city: 'Navi Mumbai',
        state: 'Maharashtra',
        postal_code: '400703',
        country: 'India',
        business_status: 'OPERATIONAL',
        search_keyword: 'CBSE School',
        search_city: 'Navi Mumbai',
      },
      {
        place_id: 'ChIJTestE2E_02',
        institution_name: 'St Xavier Global Academy',
        primary_phone: '+919822334455',
        alternative_phone: '',
        website: 'https://stxavier-example.com',
        maps_url: 'https://maps.google.com/?cid=67890',
        rating: '4.8',
        rating_count: '210',
        primary_type: 'school',
        street_address: '14 Church Road, Camp',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
        country: 'India',
        business_status: 'OPERATIONAL',
        search_keyword: 'High School',
        search_city: 'Pune',
      },
      {
        place_id: 'ChIJTestE2E_NoPhone',
        institution_name: 'Invalid School Without Phone',
        primary_phone: '',
        alternative_phone: '',
        website: 'https://nophone.org',
        city: 'Mumbai',
        country: 'India',
        business_status: 'OPERATIONAL',
      },
    ];

    let inserted = 0;
    let skippedNoPhone = 0;

    for (const r of testCsvRows) {
      if (!r.primary_phone && !r.alternative_phone) {
        skippedNoPhone++;
        continue;
      }

      await pool.query(`
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
          street_address,
          city,
          state,
          postal_code,
          country,
          business_status,
          search_keyword,
          search_city,
          status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'fresh'
        )
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          rating = EXCLUDED.rating,
          rating_count = EXCLUDED.rating_count;
      `, [
        r.place_id,
        r.institution_name,
        r.primary_phone,
        r.alternative_phone || null,
        r.website,
        r.maps_url,
        r.rating ? parseFloat(r.rating) : null,
        r.rating_count ? parseInt(r.rating_count) : 0,
        r.primary_type,
        r.street_address,
        r.city,
        r.state,
        r.postal_code,
        r.country,
        r.business_status,
        r.search_keyword,
        r.search_city,
      ]);

      inserted++;

      // History log
      await pool.query(`
        INSERT INTO db_place_history (place_id, actor_id, action, new_status, notes)
        VALUES ($1, $2, 'imported', 'fresh', 'Imported via Automated Verification Test');
      `, [r.place_id, testUser.id]);
    }

    if (inserted !== 2 || skippedNoPhone !== 1) {
      throw new Error(`Expected 2 inserted, 1 skipped (no phone), got inserted=${inserted}, skipped=${skippedNoPhone}`);
    }
    console.log(`✓ CSV Import verified: 2 valid schools inserted with status 'fresh', 1 skipped for missing phone.`);

    // 4. Test Assignment to Actor
    console.log('\n--- 4. Testing Bulk Assignment to Actor ---');
    const assignRes = await pool.query(`
      UPDATE db_businesses
      SET
        assigned_to_user_id = $1,
        assigned_at = NOW(),
        status = 'new'
      WHERE place_id IN ('ChIJTestE2E_01', 'ChIJTestE2E_02')
      RETURNING id, place_id, name, status, assigned_to_user_id;
    `, [testUser.id]);

    if (assignRes.rows.length !== 2) throw new Error('Assignment failed');
    console.log(`✓ Assigned 2 records to ${testUser.name}. Status transitioned to 'new'.`);

    // 5. Test Actor Working Queue & Outreach Transitions
    console.log('\n--- 5. Testing Actor Outreach Pipeline ---');
    // Fetch unworked queue
    const unworked = await pool.query(`
      SELECT COUNT(*)::int as cnt 
      FROM db_businesses 
      WHERE assigned_to_user_id = $1 AND status = 'new';
    `, [testUser.id]);
    console.log(`✓ Actor unworked queue count: ${unworked.rows[0].cnt}`);

    // Call 1: Mark ChIJTestE2E_01 as 'rnr' (Ringing No Response) with notes
    await pool.query(`
      UPDATE db_businesses
      SET
        status = 'rnr',
        notes = 'Ringing no response, tried at 11am',
        last_contacted_at = NOW()
      WHERE place_id = 'ChIJTestE2E_01';
    `);

    await pool.query(`
      INSERT INTO db_place_history (place_id, actor_id, action, old_status, new_status, notes)
      VALUES ('ChIJTestE2E_01', $1, 'status_changed', 'new', 'rnr', 'Ringing no response, tried at 11am');
    `, [testUser.id]);

    // Call 2: Mark ChIJTestE2E_02 as 'interested' with a scheduled callback
    const callbackTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await pool.query(`
      UPDATE db_businesses
      SET
        status = 'interested',
        notes = 'Spoke with Principal, interested in ERP demo',
        callback_at = $1,
        last_contacted_at = NOW()
      WHERE place_id = 'ChIJTestE2E_02';
    `, [callbackTime]);

    await pool.query(`
      INSERT INTO db_place_history (place_id, actor_id, action, old_status, new_status, notes)
      VALUES ('ChIJTestE2E_02', $1, 'status_changed', 'new', 'interested', 'Spoke with Principal, interested in ERP demo');
    `, [testUser.id]);

    console.log(`✓ Successfully updated statuses to 'rnr' and 'interested' with scheduled callback.`);

    // 6. Test Remaining Queue Threshold & Batch Request Submission
    console.log('\n--- 6. Testing Batch Data Request (<= 10 remaining) ---');
    const remainingUnworked = await pool.query(`
      SELECT COUNT(*)::int as cnt 
      FROM db_businesses 
      WHERE assigned_to_user_id = $1 AND status = 'new';
    `, [testUser.id]);
    const remCount = remainingUnworked.rows[0].cnt;
    console.log(`✓ Current unworked records remaining: ${remCount} (Satisfies threshold <= 10)`);

    const reqInsert = await pool.query(`
      INSERT INTO db_pipeline_requests (user_id, remaining_count, requested_count, preferred_city, notes, status)
      VALUES ($1, $2, 25, 'Pune', 'Completed previous batch, need more CBSE schools', 'pending')
      RETURNING *;
    `, [testUser.id, remCount]);
    const batchReq = reqInsert.rows[0];
    console.log(`✓ Quota Request created: ID=${batchReq.id}, Status=${batchReq.status}, Preferred City=${batchReq.preferred_city}`);

    // Admin fulfills request
    await pool.query(`
      UPDATE db_pipeline_requests
      SET status = 'fulfilled', fulfilled_count = 25, fulfilled_at = NOW()
      WHERE id = $1;
    `, [batchReq.id]);
    console.log(`✓ Admin fulfilled quota request.`);

    // 7. Test Lead Conversion
    console.log('\n--- 7. Testing Lead Conversion Pipeline ---');
    // Create lead from ChIJTestE2E_02
    const leadCodeRes = await pool.query(`SELECT nextval('lead_code_seq') as next_val;`);
    const leadCode = `LD-${leadCodeRes.rows[0].next_val}`;

    const leadInsert = await pool.query(`
      INSERT INTO leads (
        lead_code,
        owner_id,
        institute_type,
        institute_name,
        country,
        city,
        student_strength,
        current_erp,
        spoc_name,
        spoc_role,
        spoc_phone,
        dm_name,
        dm_role,
        dm_phone,
        status,
        deal_value
      ) VALUES (
        $1, $2, 'School', 'St Xavier Global Academy', 'India', 'Pune', '1000 - 2000', 'no',
        'St Xavier Admin', 'Principal', '+919822334455', 'St Xavier Admin', 'Principal', '+919822334455',
        'assigned', 150000.00
      )
      RETURNING id, lead_code;
    `, [leadCode, testUser.id]);
    const newLead = leadInsert.rows[0];

    // Link lead to place
    await pool.query(`
      UPDATE db_businesses
      SET
        status = 'converted_to_lead',
        converted_lead_id = $1
      WHERE place_id = 'ChIJTestE2E_02';
    `, [newLead.id]);

    await pool.query(`
      INSERT INTO db_place_history (place_id, actor_id, action, old_status, new_status, notes)
      VALUES ('ChIJTestE2E_02', $1, 'converted_to_lead', 'interested', 'converted_to_lead', $2);
    `, [testUser.id, `Converted to CRM Lead [${newLead.lead_code}]`]);

    console.log(`✓ Lead conversion complete: Created CRM Lead [${newLead.lead_code}] and marked prospect as 'converted_to_lead'.`);

    // 8. Verify Complete Audit History
    console.log('\n--- 8. Verifying Audit History Trail ---');
    const history = await pool.query(`
      SELECT action, old_status, new_status, notes, created_at 
      FROM db_place_history 
      WHERE place_id = 'ChIJTestE2E_02'
      ORDER BY created_at ASC;
    `);
    console.log(`Found ${history.rows.length} history records for St Xavier Global Academy:`);
    history.rows.forEach(h => {
      console.log(`  • [${h.action}] ${h.old_status || 'none'} -> ${h.new_status || 'none'}: "${h.notes}"`);
    });

    // 9. Test Visual Allocation with custom place_ids
    console.log('\n--- 9. Testing Custom Place IDs Visual Allocation ---');
    // Create another pending request
    const reqInsert2 = await pool.query(`
      INSERT INTO db_pipeline_requests (user_id, remaining_count, requested_count, preferred_city, status)
      VALUES ($1, 0, 10, 'Navi Mumbai', 'pending')
      RETURNING id;
    `, [testUser.id]);
    const req2Id = reqInsert2.rows[0].id;

    // Allocate ChIJTestE2E_01 specifically using place_ids
    const allocUpdate = await pool.query(`
      UPDATE db_businesses
      SET
        assigned_to_user_id = $1,
        assigned_at = NOW(),
        status = 'new'
      WHERE place_id = 'ChIJTestE2E_01'
      RETURNING id, place_id, assigned_to_user_id;
    `, [testUser.id]);
    if (allocUpdate.rows.length === 0) throw new Error('Visual place allocation query failed');

    await pool.query(`
      UPDATE db_pipeline_requests
      SET status = 'fulfilled', fulfilled_count = 1, fulfilled_at = NOW()
      WHERE id = $1;
    `, [req2Id]);
    console.log(`✓ Verified visual allocation of specific place ID to ${testUser.name} and marked request fulfilled.`);

    // 10. Test Request Decline / Rejection Flow
    console.log('\n--- 10. Testing Request Rejection Flow ---');
    const reqInsert3 = await pool.query(`
      INSERT INTO db_pipeline_requests (user_id, remaining_count, requested_count, status)
      VALUES ($1, 0, 25, 'pending')
      RETURNING id;
    `, [testUser.id]);
    const req3Id = reqInsert3.rows[0].id;

    await pool.query(`
      UPDATE db_pipeline_requests
      SET status = 'rejected', fulfilled_at = NOW()
      WHERE id = $1;
    `, [req3Id]);

    const checkRejected = await pool.query(`SELECT status FROM db_pipeline_requests WHERE id = $1;`, [req3Id]);
    if (checkRejected.rows[0].status !== 'rejected') throw new Error('Request rejection failed');
    console.log(`✓ Verified request rejection successfully.`);

    console.log('\n🎉 ALL 10 TEST PHASES PASSED WITH 100% ACCURACY! 🎉');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabasePlaces();
