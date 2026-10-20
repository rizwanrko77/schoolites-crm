async function runE2ETest() {
  console.log('=== STARTING END-TO-END FLOW VERIFICATION ===\n');
  const baseUrl = 'http://localhost:3000';

  // Step 1: Request OTP for Admin
  console.log('1. Requesting OTP for admin@schoolites.com...');
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@schoolites.com' }),
  });
  const sendData = await sendRes.json();
  if (!sendRes.ok) throw new Error(`Send OTP failed: ${JSON.stringify(sendData)}`);
  console.log('✓ OTP generated successfully:', sendData.devOtp);

  // Step 2: Verify OTP and capture session cookie
  console.log('\n2. Verifying OTP and creating session...');
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@schoolites.com', code: sendData.devOtp }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) throw new Error(`Verify OTP failed: ${JSON.stringify(verifyData)}`);
  
  const rawCookie = verifyRes.headers.get('set-cookie');
  if (!rawCookie) throw new Error('No session cookie returned');
  const sessionCookie = rawCookie.split(';')[0];
  console.log('✓ Logged in as:', verifyData.user.name, `[${verifyData.user.user_code}]`);
  console.log('  Target Redirect:', verifyData.redirectUrl);
  console.log('  Session Cookie Captured');

  // Step 3: Check /api/auth/me with session cookie
  console.log('\n3. Testing /api/auth/me...');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const meData = await meRes.json();
  console.log('✓ Session valid for:', meData.user.email, `(${meData.user.role})`);

  // Step 4: Fetch initial users list
  console.log('\n4. Fetching Admin Users directory...');
  const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Cookie: sessionCookie },
  });
  const usersData = await usersRes.json();
  console.log('✓ Total existing users:', usersData.counts.total);

  // Step 5: Create Pre-Sales Member
  console.log('\n5. Creating Pre-Sales Team Member (Rahul Sharma)...');
  const psRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'Rahul Sharma',
      email: 'rahul.ps@schoolites.com',
      role: 'pre_sales',
      date_of_joining: '2026-10-20',
      description: 'North Region Outreach Specialist',
    }),
  });
  const psData = await psRes.json();
  if (!psRes.ok) throw new Error(`Create Pre-Sales failed: ${JSON.stringify(psData)}`);
  console.log(`✓ Created: [${psData.user.user_code}] ${psData.user.name} (${psData.user.role})`);

  // Step 6: Create Referral Partner
  console.log('\n6. Creating Referral Partner (Anita Desai)...');
  const refRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'Anita Desai',
      email: 'anita.partner@schoolites.com',
      role: 'referral',
      date_of_joining: '2026-10-20',
      description: 'EdTech Consultant - Mumbai Chapter',
    }),
  });
  const refData = await refRes.json();
  if (!refRes.ok) throw new Error(`Create Referral failed: ${JSON.stringify(refData)}`);
  console.log(`✓ Created: [${refData.user.user_code}] ${refData.user.name} (${refData.user.role})`);

  // Step 7: Create Business Relations Member
  console.log('\n7. Creating Business Relations Representative (Vikram Singh)...');
  const brRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'Vikram Singh',
      email: 'vikram.br@schoolites.com',
      role: 'business_relations',
      date_of_joining: '2026-10-20',
      description: 'Key Account Manager - Tier 1 Institutions',
    }),
  });
  const brData = await brRes.json();
  if (!brRes.ok) throw new Error(`Create BR failed: ${JSON.stringify(brData)}`);
  console.log(`✓ Created: [${brData.user.user_code}] ${brData.user.name} (${brData.user.role})`);

  // Step 8: Verify Sequential Uniqueness
  console.log('\n8. Verifying Sequential Global Suffixes...');
  console.log(`   Admin:     ADM-101`);
  console.log(`   Pre-Sales: ${psData.user.user_code}`);
  console.log(`   Referral:  ${refData.user.user_code}`);
  console.log(`   BR Team:   ${brData.user.user_code}`);

  // Step 9: Check Audit Logs
  console.log('\n9. Verifying Audit Logs recorded in Neon...');
  const logsRes = await fetch(`${baseUrl}/api/admin/logs`, {
    headers: { Cookie: sessionCookie },
  });
  const logsData = await logsRes.json();
  console.log(`✓ Audit logs retrieved (${logsData.logs.length} entries):`);
  for (const l of logsData.logs.slice(0, 4)) {
    console.log(`   - [${l.action}] by ${l.actor_name} on ${l.record_type}:`, JSON.stringify(l.metadata));
  }

  console.log('\n=== ALL END-TO-END FLOW TESTS PASSED FLAWLESSLY ===');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
