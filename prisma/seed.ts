import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Admin User ──
  const adminPassword = await bcrypt.hash('admin@aravali2026', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aravali.in' },
    update: {},
    create: {
      email: 'admin@aravali.in',
      name: 'System Admin',
      role: 'ADMIN',
      region: 'PAN_INDIA',
      passwordHash: adminPassword,
    },
  });
  console.log(`  ✓ Admin user: ${admin.email}`);

  // ── Regional Sales Users ──
  const salesPassword = await bcrypt.hash('sales@aravali2026', 12);
  const regions = [
    { email: 'sales.west@aravali.in', name: 'Priya Menon', region: 'WEST' },
    { email: 'sales.north@aravali.in', name: 'Amit Kumar', region: 'NORTH' },
    { email: 'sales.south@aravali.in', name: 'Deepa Reddy', region: 'SOUTH' },
    { email: 'sales.east@aravali.in', name: 'Suman Das', region: 'EAST' },
  ];

  for (const r of regions) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      update: {},
      create: {
        email: r.email,
        name: r.name,
        role: 'SALES',
        region: r.region as any,
        passwordHash: salesPassword,
      },
    });
    console.log(`  ✓ Sales user: ${user.email} (${r.region})`);
  }

  // ── Sample Portfolio Projects ──
  const projects = [
    {
      title: 'Tata Communications — Global Headquarters',
      slug: 'tata-communications-hq',
      client: 'Tata Communications',
      sector: 'office',
      city: 'Mumbai',
      areaSqft: 120000,
      budgetDisplay: '₹85 Cr',
      durationMonths: 14,
      description: '1,20,000 sq ft flagship headquarters in Powai, Mumbai. Activity-based working across 8 floors with rooftop collaboration zones and a 200-seat auditorium.',
      challenge: 'Consolidating 4 separate offices into one cohesive campus while maintaining operations during phased move.',
      solution: 'Phased design-build with swing space strategy. BIM-coordinated MEP enabling concurrent construction across floors.',
      impact: '40% reduction in energy consumption. 30% improvement in space utilization. Achieved IGBC Platinum on first submission.',
      sustainability: { certification: 'IGBC Platinum', energySaved: 40, waterSaved: 35, wasteDiverted: 94 },
      featured: true,
      published: true,
      sortOrder: 1,
    },
    {
      title: 'Infosys — Innovation Hub',
      slug: 'infosys-innovation-hub',
      client: 'Infosys BPO',
      sector: 'tech',
      city: 'Bangalore',
      areaSqft: 68000,
      budgetDisplay: '₹42 Cr',
      durationMonths: 9,
      description: '68,000 sq ft innovation centre in Electronic City. Agile neighborhoods, maker spaces, and a living lab for workplace technology testing.',
      sustainability: { certification: 'LEED Gold', energySaved: 38, waterSaved: 45, wasteDiverted: 91 },
      featured: true,
      published: true,
      sortOrder: 2,
    },
    {
      title: 'Deutsche Bank — India Operations',
      slug: 'deutsche-bank-india',
      client: 'Deutsche Bank',
      sector: 'banking',
      city: 'Multi-City',
      areaSqft: 280000,
      budgetDisplay: '₹165 Cr',
      durationMonths: 22,
      description: '2,80,000 sq ft pan-India rollout across Mumbai BKC, Pune Hinjewadi, and Jaipur. Global standards adapted for Indian compliance and climate.',
      featured: true,
      published: true,
      sortOrder: 3,
    },
    {
      title: 'Apollo — Diagnostic Centre',
      slug: 'apollo-diagnostic-centre',
      client: 'Apollo Hospitals',
      sector: 'healthcare',
      city: 'Hyderabad',
      areaSqft: 35000,
      budgetDisplay: '₹28 Cr',
      durationMonths: 7,
      description: '35,000 sq ft diagnostic facility with infection-control ventilation, cleanroom environments, and patient-centred wayfinding.',
      sustainability: { certification: 'IGBC Gold', energySaved: 32, wasteDiverted: 88 },
      published: true,
      sortOrder: 4,
    },
    {
      title: 'Stripe — India Launch Office',
      slug: 'stripe-india-launch',
      client: 'Stripe',
      sector: 'tech',
      city: 'Bangalore',
      areaSqft: 45000,
      budgetDisplay: '₹32 Cr',
      durationMonths: 6,
      description: '45,000 sq ft debut India office designed for hypergrowth with 60% expansion capacity built into the infrastructure.',
      published: true,
      sortOrder: 5,
    },
  ];

  for (const p of projects) {
    const proj = await prisma.portfolioProject.upsert({
      where: { slug: p.slug },
      update: {},
      create: p as any,
    });
    console.log(`  ✓ Portfolio: ${proj.title}`);
  }

  // ── Sample Blog Posts ──
  const posts = [
    {
      title: 'IGBC Green Interiors 2026: What\'s Changed and What It Means for Your Next Office',
      slug: 'igbc-green-interiors-2026-changes',
      excerpt: 'The updated IGBC rating system introduces stricter embodied carbon requirements. Here\'s how to prepare your project.',
      content: 'Full article content goes here...',
      category: 'Sustainability',
      authorId: admin.id,
      published: true,
      publishedAt: new Date('2026-02-12'),
      seoTitle: 'IGBC Green Interiors 2026 Updates | Aravali Interiors',
      seoDescription: 'Key changes in IGBC Green Interiors 2026 rating system and how they affect commercial interior projects in India.',
    },
    {
      title: 'The India GCC Playbook: Designing Offices That Attract Global Talent in Tier II Cities',
      slug: 'india-gcc-playbook-tier-2-offices',
      excerpt: 'How multinationals are rethinking workplace design as GCCs expand beyond Bangalore and Hyderabad.',
      content: 'Full article content goes here...',
      category: 'Workplace',
      authorId: admin.id,
      published: true,
      publishedAt: new Date('2026-01-28'),
    },
    {
      title: 'From Concept to Keys in 6 Months: How Stripe Launched Their India Office at Speed',
      slug: 'stripe-india-office-case-study',
      excerpt: 'A behind-the-scenes look at delivering a 45,000 sq ft hypergrowth-ready workspace in record time.',
      content: 'Full article content goes here...',
      category: 'Case Study',
      authorId: admin.id,
      published: true,
      publishedAt: new Date('2026-01-15'),
    },
  ];

  for (const p of posts) {
    const post = await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: p as any,
    });
    console.log(`  ✓ Blog post: ${post.title}`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin: admin@aravali.in / admin@aravali2026');
  console.log('   Sales: sales.west@aravali.in / sales@aravali2026');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
