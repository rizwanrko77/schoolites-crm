import path from 'path';
import dotenv from 'dotenv';
import { sql } from '../lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seedAssets() {
  console.log('Seeding initial marketing assets...');

  const adminRes = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  const adminId = adminRes.length > 0 ? adminRes[0].id : null;

  const initialAssets = [
    {
      title: 'Schoolites Comprehensive Institutional Brochure (2026)',
      category: 'Brochures',
      file_type: 'pdf',
      content_url: 'https://drive.google.com/file/d/schoolites-institutional-brochure-2026/view',
      description: 'Official 8-page overview covering admission automation, educator monetization, and ERP connectivity.',
    },
    {
      title: 'Principal Connect: Direct WhatsApp & Email Outreach Pitch',
      category: 'Pitch Templates',
      file_type: 'text',
      content_url: `Respected Principal / Trustee,\n\nI hope this message finds you well. I am reaching out on behalf of Schoolites, an advanced institutional platform designed to streamline campus workflows, empower educators, and enhance student engagement.\n\nWe would love to share a brief 15-minute walkthrough of how Schoolites integrates seamlessly with your existing infrastructure. Please let us know your preferred slot this week.\n\nWarm regards,\n[Your Name] | Schoolites Representative`,
      description: 'Standard customized introductory outreach template for school leadership.',
    },
    {
      title: 'Schoolites Platform Interactive Walkthrough & Demo',
      category: 'Demos',
      file_type: 'video_link',
      content_url: 'https://www.youtube.com/watch?v=schoolites-platform-demo-2026',
      description: 'A 5-minute video walkthrough highlighting key features, educator monetization tools, and student portals.',
    },
  ];

  for (const asset of initialAssets) {
    const existing = await sql`SELECT id FROM assets WHERE title = ${asset.title} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO assets (title, category, file_type, content_url, description, is_active, created_by)
        VALUES (${asset.title}, ${asset.category}, ${asset.file_type}, ${asset.content_url}, ${asset.description}, TRUE, ${adminId})
      `;
      console.log(`✓ Seeded asset: ${asset.title}`);
    } else {
      console.log(`- Asset already exists: ${asset.title}`);
    }
  }

  console.log('Marketing assets seeded successfully.');
}

seedAssets().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
