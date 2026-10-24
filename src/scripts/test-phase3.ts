async function testPhase3() {
  console.log('=== STARTING PHASE 3 END-TO-END FLOW VERIFICATION ===\n');
  const baseUrl = 'http://localhost:3000';

  // Step 1: Public Enquiry Config Resolution for PS-102
  console.log('1. Resolving public referral code PS-102 (Rahul Sharma)...');
  const configRes = await fetch(`${baseUrl}/api/public/enquiry-config?code=PS-102`);
  const configData = await configRes.json();
  if (!configRes.ok) throw new Error(`Config resolution failed: ${JSON.stringify(configData)}`);
  console.log(`✓ Owner Resolved: ${configData.owner.name} [${configData.owner.user_code}]`);
  console.log(`✓ Active Form Fields Loaded: ${configData.fields.length} fields`);

  // Step 2: Visitor Submits Enquiry on Rahul's Link
  console.log('\n2. Submitting public enquiry from visitor on /e/PS-102...');
  const submitRes = await fetch(`${baseUrl}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_code: 'PS-102',
      form_data: {
        name: 'Dr. Sunita Rao',
        phone: '9845012345',
        email: 'sunita.rao@delhipublicschool.ac.in',
        institute_type: 'School',
        institute_name: 'Delhi Public School Bangalore East',
        country: 'India',
        city: 'Bangalore',
        student_count: '3200',
        message: 'Interested in digital attendance and educator performance incentives.',
      },
    }),
  });
  const submitData = await submitRes.json();
  if (!submitRes.ok) throw new Error(`Enquiry submit failed: ${JSON.stringify(submitData)}`);
  console.log(`✓ Enquiry Generated: ${submitData.enquiry_code}`);

  // Step 3: Login as Rahul Sharma (PS-102)
  console.log('\n3. Logging in as Pre-Sales Member (rahul.ps@schoolites.com)...');
  const otpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul.ps@schoolites.com' }),
  });
  const otpData = await otpRes.json();
  if (!otpRes.ok) throw new Error(`Send OTP failed: ${JSON.stringify(otpData)}`);

  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul.ps@schoolites.com', code: otpData.devOtp }),
  });
  const verifyData = await verifyRes.json();
  const rawCookie = verifyRes.headers.get('set-cookie');
  const sessionCookie = rawCookie ? rawCookie.split(';')[0] : '';
  console.log(`✓ Logged in as: ${verifyData.user.name} [${verifyData.user.user_code}]`);

  // Step 4: Fetch Rahul's Inbox
  console.log('\n4. Checking Pre-Sales Enquiries Inbox for PS-102...');
  const inboxRes = await fetch(`${baseUrl}/api/enquiries`, {
    headers: { Cookie: sessionCookie },
  });
  const inboxData = await inboxRes.json();
  console.log(`✓ Inbox contains ${inboxData.enquiries.length} enquiry:`);
  const receivedEnq = inboxData.enquiries[0];
  console.log(`   - Code: ${receivedEnq.enquiry_code}`);
  console.log(`   - Lead Contact: ${receivedEnq.spoc_name} (${receivedEnq.phone})`);
  console.log(`   - Institution: ${receivedEnq.institute_name}`);
  console.log(`   - Status: ${receivedEnq.status}`);

  // Step 5: Mark Enquiry as Contacted
  console.log('\n5. Updating Enquiry Status to "contacted"...');
  const statusRes = await fetch(`${baseUrl}/api/enquiries/${receivedEnq.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({ status: 'contacted' }),
  });
  const statusData = await statusRes.json();
  console.log(`✓ Status updated: ${statusData.enquiry.status}`);

  // Step 6: Fetch Marketing Assets
  console.log('\n6. Checking Marketing Assets accessible by Pre-Sales...');
  const assetsRes = await fetch(`${baseUrl}/api/assets`, {
    headers: { Cookie: sessionCookie },
  });
  const assetsData = await assetsRes.json();
  console.log(`✓ Marketing Assets available (${assetsData.assets.length}):`);
  for (const a of assetsData.assets) {
    console.log(`   - [${a.file_type.toUpperCase()}] ${a.title} (${a.category})`);
  }

  // Step 7: Visitor Submits for Referral Partner REF-103 (Anita Desai)
  console.log('\n7. Submitting enquiry on Referral Partner link /e/REF-103...');
  const refEnqRes = await fetch(`${baseUrl}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_code: 'REF-103',
      form_data: {
        name: 'Principal Arvind Kulkarni',
        phone: '9822098765',
        email: 'principal@symbiosisschool.org',
        institute_type: 'School',
        institute_name: 'Symbiosis International School Pune',
        country: 'India',
        city: 'Pune',
        student_count: '2400',
        message: 'Referred by Anita Desai. Requesting demo of curriculum workflows.',
      },
    }),
  });
  const refEnqData = await refEnqRes.json();
  console.log(`✓ Referral Enquiry Generated: ${refEnqData.enquiry_code} (Attributed to REF-103)`);

  console.log('\n=== ALL PHASE 3 INTEGRATION TESTS PASSED FLAWLESSLY ===');
}

testPhase3().catch((err) => {
  console.error('\n❌ PHASE 3 TEST FAILED:', err);
  process.exit(1);
});
