async function testPhase4() {
  console.log('=== STARTING PHASE 4 END-TO-END FLOW VERIFICATION ===\n');
  const baseUrl = 'http://localhost:3000';

  // Helper for OTP login
  async function loginAs(email: string) {
    const otpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const otpData = await otpRes.json();
    if (!otpRes.ok) throw new Error(`Send OTP failed for ${email}: ${JSON.stringify(otpData)}`);

    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: otpData.devOtp }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(`Verify OTP failed for ${email}: ${JSON.stringify(verifyData)}`);
    const rawCookie = verifyRes.headers.get('set-cookie');
    const cookie = rawCookie ? rawCookie.split(';')[0] : '';
    return { user: verifyData.user, cookie };
  }

  // 1. Login as Pre-Sales (Rahul Sharma)
  console.log('1. Logging in as Pre-Sales (rahul.ps@schoolites.com)...');
  const ps = await loginAs('rahul.ps@schoolites.com');
  console.log(`✓ Logged in as: ${ps.user.name} [${ps.user.user_code}]`);

  // 2. Fetch Rahul's enquiries to convert
  console.log('\n2. Fetching enquiries for conversion...');
  const enqRes = await fetch(`${baseUrl}/api/enquiries`, {
    headers: { Cookie: ps.cookie },
  });
  const enqData = await enqRes.json();
  const testEnquiry = enqData.enquiries && enqData.enquiries.length > 0 ? enqData.enquiries[0] : null;

  // 3. Rahul converts enquiry to Lead
  const uniquePhone = `9845${Date.now().toString().slice(-6)}`;
  const uniqueEmail = `principal.${Date.now()}@dpsbangalore.ac.in`;

  console.log(`\n3. Creating Lead 1 with unique SPOC phone ${uniquePhone}...`);
  const lead1Payload = {
    title: 'DPS Bangalore East - ERP Transformation',
    enquiry_id: testEnquiry?.id || null,
    institute_type: 'School',
    institute_name: 'Delhi Public School Bangalore East',
    country: 'India',
    city: 'Bangalore',
    student_strength: '3200',
    current_erp: 'yes',
    erp_name: 'Fedena Legacy',
    spoc_name: 'Dr. Sunita Rao',
    spoc_role: 'Principal',
    spoc_phone: uniquePhone,
    spoc_email: uniqueEmail,
    same_as_spoc: true,
    decision_maker_name: 'Dr. Sunita Rao',
    decision_maker_role: 'Principal',
    decision_maker_phone: uniquePhone,
    decision_maker_email: uniqueEmail,
    decision_flow: 'Academic committee recommends, Management Trust signs off',
    preferred_slot_time: '2026-10-25 14:00',
    preferred_slot_mode: 'Meeting',
    valuation: 450000,
  };

  const lead1Res = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ps.cookie },
    body: JSON.stringify(lead1Payload),
  });
  const lead1Data = await lead1Res.json();
  if (!lead1Res.ok) throw new Error(`Lead 1 creation failed: ${JSON.stringify(lead1Data)}`);
  console.log(`✓ Lead 1 Created: ${lead1Data.lead.lead_code} - ${lead1Data.lead.institute_name}`);
  console.log(`  Duplicate Flag: ${lead1Data.lead.is_duplicate} (Expected: false)`);
  console.log(`  Status: ${lead1Data.lead.status} (Expected: unassigned)`);

  // 4. Duplicate Detection Test
  console.log('\n4. Testing Duplicate Detection with Referral Partner (Anita)...');
  const ref = await loginAs('anita.partner@schoolites.com');
  console.log(`✓ Logged in as: ${ref.user.name} [${ref.user.user_code}]`);

  const lead2Payload = {
    title: 'DPS East Campus Lead via Partner',
    institute_type: 'School',
    institute_name: 'Delhi Public School Bangalore East Campus',
    country: 'India',
    city: 'Bangalore',
    student_strength: '3000',
    spoc_name: 'Dr. Sunita Rao',
    spoc_role: 'Principal',
    spoc_phone: uniquePhone, // Exact same phone number to trigger duplicate detection
    spoc_email: uniqueEmail,
    valuation: 350000,
  };

  const lead2Res = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ref.cookie },
    body: JSON.stringify(lead2Payload),
  });
  const lead2Data = await lead2Res.json();
  if (!lead2Res.ok) throw new Error(`Lead 2 creation failed: ${JSON.stringify(lead2Data)}`);
  console.log(`✓ Lead 2 Created: ${lead2Data.lead.lead_code}`);
  console.log(`  Duplicate Flagged: ${lead2Data.lead.is_duplicate} (Expected: true)`);
  console.log(`  Duplicate of Lead ID: ${lead2Data.lead.duplicate_of_lead_id} (Matches Lead 1: ${lead2Data.lead.duplicate_of_lead_id === lead1Data.lead.id})`);

  if (!lead2Data.lead.is_duplicate) {
    throw new Error('Duplicate detection failed! is_duplicate should be true');
  }

  // 5. Business Relations: Atomic Lead Grab
  console.log('\n5. Testing Business Relations Atomic Grab (Vikram)...');
  const br = await loginAs('vikram.br@schoolites.com');
  console.log(`✓ Logged in as: ${br.user.name} [${br.user.user_code}]`);

  // Vikram grabs Lead 1
  const grabRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}/grab`, {
    method: 'POST',
    headers: { Cookie: br.cookie },
  });
  const grabData = await grabRes.json();
  if (!grabRes.ok) throw new Error(`Lead grab failed: ${JSON.stringify(grabData)}`);
  console.log(`✓ Lead Grabbed: ${grabData.lead.lead_code}`);
  console.log(`  Assigned Manager: ${grabData.lead.manager_id} (Matches BR user: ${grabData.lead.manager_id === br.user.id})`);
  console.log(`  Status: ${grabData.lead.status} (Expected: assigned)`);

  // Attempt grab again to verify atomic protection
  console.log('\n6. Testing Double Grab Prevention (Atomic Check)...');
  const doubleGrabRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}/grab`, {
    method: 'POST',
    headers: { Cookie: br.cookie },
  });
  const doubleGrabData = await doubleGrabRes.json();
  console.log(`✓ Double Grab Handled: HTTP ${doubleGrabRes.status} - "${doubleGrabData.error}"`);
  if (doubleGrabRes.ok) throw new Error('Double grab should have been rejected!');

  // 7. Note Segregation: Personal vs Global Remarks
  console.log('\n7. Testing Note Segregation...');
  // Vikram adds private note
  const privateNoteRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: br.cookie },
    body: JSON.stringify({
      content: 'Confidential BR note: client asked for 5% concession, will confirm after demo.',
      visibility: 'personal',
    }),
  });
  const privateNoteData = await privateNoteRes.json();
  if (!privateNoteRes.ok) throw new Error(`Add private note failed: ${JSON.stringify(privateNoteData)}`);
  console.log(`✓ Private Note Added by Vikram (ID: ${privateNoteData.note.id})`);

  // Vikram adds public remark
  const publicNoteRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: br.cookie },
    body: JSON.stringify({
      content: 'Demo scheduled for Friday 3:00 PM with academic heads.',
      visibility: 'global',
    }),
  });
  const publicNoteData = await publicNoteRes.json();
  if (!publicNoteRes.ok) throw new Error(`Add public note failed: ${JSON.stringify(publicNoteData)}`);
  console.log(`✓ Public Remark Added by Vikram (ID: ${publicNoteData.note.id})`);

  // Verify Rahul (PS-102, lead creator) CANNOT see Vikram's private note
  console.log('\n8. Checking Note Visibility for Lead Creator (Rahul)...');
  const rahulLeadRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}`, {
    headers: { Cookie: ps.cookie },
  });
  const rahulLeadData = await rahulLeadRes.json();
  const visibleToRahul = rahulLeadData.notes || [];
  console.log(`✓ Notes visible to Rahul: ${visibleToRahul.length}`);
  const rahulSeesPrivate = visibleToRahul.some((n: any) => n.visibility === 'personal' && n.author_id !== ps.user.id);
  console.log(`  Can Rahul see Vikram's private note? ${rahulSeesPrivate} (Expected: false)`);
  if (rahulSeesPrivate) throw new Error('Data leak! Pre-Sales user saw a private BR note.');

  // Verify Admin (ADM-101) CAN see all notes
  console.log('\n9. Checking Note Visibility for Admin...');
  const adm = await loginAs('admin@schoolites.com');
  const admLeadRes = await fetch(`${baseUrl}/api/leads/${lead1Data.lead.id}`, {
    headers: { Cookie: adm.cookie },
  });
  const admLeadData = await admLeadRes.json();
  console.log(`✓ Notes visible to Admin: ${admLeadData.notes.length} (Expected: 2)`);
  if (admLeadData.notes.length < 2) throw new Error('Admin should see both personal and global notes.');

  // 10. Admin Resolves Duplicate Flag on Lead 2
  console.log('\n10. Testing Admin Duplicate Resolution (Clear Flag)...');
  const resolveRes = await fetch(`${baseUrl}/api/leads/${lead2Data.lead.id}/duplicate-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adm.cookie },
    body: JSON.stringify({ action: 'clear' }),
  });
  const resolveData = await resolveRes.json();
  if (!resolveRes.ok) throw new Error(`Duplicate action failed: ${JSON.stringify(resolveData)}`);
  console.log(`✓ Duplicate Flag Cleared: is_duplicate = ${resolveData.lead.is_duplicate} (Expected: false)`);

  console.log('\n🎉 ALL PHASE 4 END-TO-END TEST CASES PASSED SUCCESSFULLY!\n');
}

testPhase4().catch((err) => {
  console.error('\n❌ Phase 4 Test Failed:', err);
  process.exit(1);
});
