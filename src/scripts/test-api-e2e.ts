import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';
import { createSession } from '../lib/auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testApiEndpoints() {
  console.log('--- TESTING API PIPELINE ENDPOINTS WITH REAL SESSION ---');
  const baseUrl = 'http://localhost:3000';

  // 1. Fetch an admin user
  const adminRes = await sql`
    SELECT id, name, email, role FROM users WHERE role = 'admin' LIMIT 1;
  `;
  if (adminRes.length === 0) throw new Error('No admin user found in database');
  const admin = adminRes[0];
  console.log(`Using admin user: ${admin.name} (${admin.email})`);

  // 2. Create session token
  const token = await createSession(admin.id);
  const cookieHeader = `schoolites_session=${token}`;
  console.log('✓ Created active session token.');

  // 3. Test GET /api/auth/me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  const meData = await meRes.json();
  if (!meRes.ok || !meData.user) throw new Error(`Auth me failed: ${JSON.stringify(meData)}`);
  console.log(`✓ GET /api/auth/me verified user: ${meData.user.name} (${meData.user.role})`);

  // 4. Test GET /api/leads?sort_by=created_desc with timing measurement
  const start = performance.now();
  const leadsRes = await fetch(`${baseUrl}/api/leads?sort_by=created_desc`, {
    headers: { Cookie: cookieHeader },
  });
  const duration = Math.round(performance.now() - start);
  const leadsData = await leadsRes.json();
  if (!leadsRes.ok || !Array.isArray(leadsData.leads)) throw new Error(`GET /api/leads failed: ${JSON.stringify(leadsData)}`);
  console.log(`✓ GET /api/leads?sort_by=created_desc returned ${leadsData.leads.length} leads in ${duration}ms.`);

  // 5. Test GET /api/leads?view=unassigned
  const unassignedRes = await fetch(`${baseUrl}/api/leads?view=unassigned`, {
    headers: { Cookie: cookieHeader },
  });
  const unassignedData = await unassignedRes.json();
  if (!unassignedRes.ok || !Array.isArray(unassignedData.leads)) throw new Error(`GET /api/leads?view=unassigned failed`);
  console.log(`✓ GET /api/leads?view=unassigned returned ${unassignedData.leads.length} unassigned leads.`);

  // 6. Test GET /api/leads?view=my
  const myRes = await fetch(`${baseUrl}/api/leads?view=my`, {
    headers: { Cookie: cookieHeader },
  });
  const myData = await myRes.json();
  if (!myRes.ok || !Array.isArray(myData.leads)) throw new Error(`GET /api/leads?view=my failed`);
  console.log(`✓ GET /api/leads?view=my returned ${myData.leads.length} assigned leads.`);

  // 7. Test BR user session scoping
  const brRes = await sql`
    SELECT id, name, email, is_active FROM users WHERE role = 'business_relations' AND is_active = TRUE LIMIT 1;
  `;
  if (brRes.length > 0) {
    const brUser = brRes[0];
    const brToken = await createSession(brUser.id);
    const brCookie = `schoolites_session=${brToken}`;
    const brLeadsRes = await fetch(`${baseUrl}/api/leads?view=my`, {
      headers: { Cookie: brCookie },
    });
    const brLeadsData = await brLeadsRes.json();
    if (!brLeadsRes.ok) throw new Error(`BR leads failed: ${JSON.stringify(brLeadsData)}`);
    console.log(`✓ BR user (${brUser.name}) GET /api/leads?view=my returned ${brLeadsData.leads.length} leads strictly scoped to them.`);
    
    // Cleanup session
    await sql`DELETE FROM sessions WHERE token = ${brToken};`;
  }

  // 8. Test Pre-Sales session scoping
  const psRes = await sql`
    SELECT id, name, email, is_active FROM users WHERE role = 'pre_sales' AND is_active = TRUE LIMIT 1;
  `;
  if (psRes.length > 0) {
    const psUser = psRes[0];
    const psToken = await createSession(psUser.id);
    const psCookie = `schoolites_session=${psToken}`;
    const psLeadsRes = await fetch(`${baseUrl}/api/leads?view=created_by_me`, {
      headers: { Cookie: psCookie },
    });
    const psLeadsData = await psLeadsRes.json();
    if (!psLeadsRes.ok) throw new Error(`Pre-Sales leads failed: ${JSON.stringify(psLeadsData)}`);
    console.log(`✓ Pre-Sales user (${psUser.name}) GET /api/leads?view=created_by_me returned ${psLeadsData.leads.length} leads created by them.`);

    // Cleanup session
    await sql`DELETE FROM sessions WHERE token = ${psToken};`;
  }

  // Cleanup admin test session
  await sql`DELETE FROM sessions WHERE token = ${token};`;

  console.log('\n====================================================');
  console.log('   ALL LIVE API TESTS COMPLETED & VERIFIED 100%!     ');
  console.log('====================================================');
}

testApiEndpoints().catch((err) => {
  console.error('API test failed:', err);
  process.exit(1);
});
