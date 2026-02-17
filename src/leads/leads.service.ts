import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, LeadStatus, LeadPriority, Region } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../config/prisma.module';
import { RedisService } from '../config/redis.module';
import { EmailService } from '../email/email.service';
import {
  CreateLeadDto, UpdateLeadStep2Dto, UpdateLeadStep3Dto,
  UpdateLeadAdminDto, LeadQueryDto, CreateLeadNoteDto,
} from './leads.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private email: EmailService,
    private config: ConfigService,
  ) {}

  // ═══════════════════════════════════════
  // PUBLIC: Create lead (Step 1)
  // ═══════════════════════════════════════
  async create(dto: CreateLeadDto, ipAddress?: string) {
    // Rate limit by IP
    if (ipAddress) {
      const key = `lead_submit:${ipAddress}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 3600);
      if (count > 5) {
        throw new ConflictException('Too many submissions. Please try again later.');
      }
    }

    // Deduplicate by email (within last 24h)
    const recent = await this.prisma.lead.findFirst({
      where: {
        email: dto.email,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent) {
      throw new ConflictException('A submission with this email was received recently. We will be in touch.');
    }

    // Create lead
    const lead = await this.prisma.lead.create({
      data: {
        fullName: dto.fullName,
        company: dto.company,
        email: dto.email,
        phone: dto.phone,
        projectType: dto.projectType,
        formStepCompleted: 1,
        resumeToken: randomBytes(32).toString('hex'),
        resumeTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Async: auto-tag, route, notify, send confirmation
    this.processNewLead(lead.id).catch(err =>
      this.logger.error(`Failed to process lead ${lead.id}`, err),
    );

    return {
      id: lead.id,
      resumeToken: lead.resumeToken,
      message: 'Thank you! We will be in touch within 48 hours.',
    };
  }

  // ═══════════════════════════════════════
  // PUBLIC: Update lead (Step 2)
  // ═══════════════════════════════════════
  async updateStep2(id: string, dto: UpdateLeadStep2Dto) {
    const lead = await this.findOrFail(id);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        approxArea: dto.approxArea,
        city: dto.city,
        budgetRange: dto.budgetRange,
        preferredStart: dto.preferredStart ? new Date(dto.preferredStart) : undefined,
        formStepCompleted: Math.max(lead.formStepCompleted, 2),
        region: dto.city ? this.mapCityToRegion(dto.city) : undefined,
      },
    });

    // Re-evaluate priority based on budget
    await this.evaluatePriority(id);

    return updated;
  }

  // ═══════════════════════════════════════
  // PUBLIC: Update lead (Step 3)
  // ═══════════════════════════════════════
  async updateStep3(id: string, dto: UpdateLeadStep3Dto) {
    const lead = await this.findOrFail(id);

    return this.prisma.lead.update({
      where: { id },
      data: {
        additionalDetails: dto.additionalDetails,
        referralSource: dto.referralSource,
        formStepCompleted: Math.max(lead.formStepCompleted, 3),
      },
    });
  }

  // ═══════════════════════════════════════
  // PUBLIC: Resume form via token
  // ═══════════════════════════════════════
  async resumeByToken(token: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { resumeToken: token },
    });

    if (!lead || (lead.resumeTokenExpiry && lead.resumeTokenExpiry < new Date())) {
      throw new NotFoundException('Invalid or expired resume link.');
    }

    return lead;
  }

  // ═══════════════════════════════════════
  // PUBLIC: Send resume link via email
  // ═══════════════════════════════════════
  async sendResumeLink(id: string) {
    const lead = await this.findOrFail(id);
    const url = `${this.config.get('FRONTEND_URL')}/enquiry/resume?token=${lead.resumeToken}`;
    await this.email.sendResumeLink(lead.email, lead.fullName, url);
    return { message: 'Resume link sent to your email.' };
  }

  // ═══════════════════════════════════════
  // ADMIN: List leads with filters
  // ═══════════════════════════════════════
  async findAll(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {};

    if (query.status) where.status = query.status as LeadStatus;
    if (query.priority) where.priority = query.priority as LeadPriority;
    if (query.region) where.region = query.region as Region;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { notes: true, attachments: true } },
        },
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  // ═══════════════════════════════════════
  // ADMIN: Lead detail
  // ═══════════════════════════════════════
  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        notes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  // ═══════════════════════════════════════
  // ADMIN: Update lead
  // ═══════════════════════════════════════
  async adminUpdate(id: string, dto: UpdateLeadAdminDto, userId: string) {
    await this.findOrFail(id);

    const data: Prisma.LeadUpdateInput = {};
    if (dto.status) data.status = dto.status as LeadStatus;
    if (dto.priority) data.priority = dto.priority as LeadPriority;
    if (dto.assignedToId) data.assignedTo = { connect: { id: dto.assignedToId } };
    if (dto.tags) data.tags = dto.tags;
    if (dto.status === 'CONTACTED') data.contactedAt = new Date();

    const updated = await this.prisma.lead.update({ where: { id }, data });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'lead.updated',
        entity: 'lead',
        entityId: id,
        changes: dto as any,
        userId,
        leadId: id,
      },
    });

    return updated;
  }

  // ═══════════════════════════════════════
  // ADMIN: Add note to lead
  // ═══════════════════════════════════════
  async addNote(leadId: string, dto: CreateLeadNoteDto, userId: string) {
    await this.findOrFail(leadId);

    return this.prisma.leadNote.create({
      data: {
        content: dto.content,
        leadId,
        userId,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  // ═══════════════════════════════════════
  // ADMIN: Dashboard KPIs
  // ═══════════════════════════════════════
  async getDashboard() {
    const [
      totalLeads,
      byStatus,
      byRegion,
      byPriority,
      thisMonth,
      lastMonth,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.groupBy({ by: ['status'], _count: true }),
      this.prisma.lead.groupBy({ by: ['region'], _count: true }),
      this.prisma.lead.groupBy({ by: ['priority'], _count: true }),
      this.prisma.lead.count({
        where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
      this.prisma.lead.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    const avgResponseTime = await this.prisma.$queryRaw<[{ avg_hours: number }]>`
      SELECT AVG(EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600) as avg_hours
      FROM leads WHERE contacted_at IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
    `;

    return {
      totalLeads,
      thisMonth,
      lastMonth,
      monthOverMonth: lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : null,
      avgResponseHours: avgResponseTime[0]?.avg_hours?.toFixed(1) || null,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      byRegion: Object.fromEntries(byRegion.filter(r => r.region).map(r => [r.region, r._count])),
      byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p._count])),
    };
  }

  // ═══════════════════════════════════════
  // ADMIN: Export leads as CSV
  // ═══════════════════════════════════════
  async exportCsv(query: LeadQueryDto): Promise<string> {
    const result = await this.findAll({ ...query, limit: 10000 });
    const headers = [
      'ID', 'Created', 'Status', 'Priority', 'Name', 'Company', 'Email', 'Phone',
      'Project Type', 'Area', 'City', 'Region', 'Budget', 'Start Date', 'Referral',
      'Assigned To', 'Form Step',
    ];

    const rows = result.data.map((l: any) => [
      l.id, l.createdAt, l.status, l.priority, l.fullName, l.company, l.email, l.phone,
      l.projectType, l.approxArea, l.city, l.region, l.budgetRange, l.preferredStart,
      l.referralSource, l.assignedTo?.name || '', l.formStepCompleted,
    ]);

    return [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
  }

  // ═══════════════════════════════════════
  // INTERNAL: Process new lead
  // ═══════════════════════════════════════
  private async processNewLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // 1. Auto-tag by project type
    const tags: string[] = [];
    if (lead.projectType) tags.push(lead.projectType.toLowerCase().replace(/[^a-z0-9]/g, '-'));

    // 2. Send confirmation email
    await this.email.sendLeadConfirmation(lead.email, lead.fullName, {
      company: lead.company ?? undefined,
      projectType: lead.projectType ?? undefined,
      resumeUrl: `${this.config.get('FRONTEND_URL')}/enquiry/resume?token=${lead.resumeToken}`,
    });

    // 3. Update tags
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { tags },
    });

    // 4. Sync to CRM
    await this.syncToCrm(leadId);

    this.logger.log(`Lead ${leadId} processed: tagged, emailed, CRM synced`);
  }

  // ═══════════════════════════════════════
  // INTERNAL: Priority evaluation
  // ═══════════════════════════════════════
  private async evaluatePriority(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    let priority: LeadPriority = LeadPriority.NORMAL;

    // High priority: budget > ₹50 Cr or area > 75,000 sqft
    const highBudgets = ['₹50 – 100 Crore', 'Above ₹100 Crore'];
    const highAreas = ['75,000 – 1,50,000 sq ft', 'Above 1,50,000 sq ft'];

    if (highBudgets.includes(lead.budgetRange || '') || highAreas.includes(lead.approxArea || '')) {
      priority = LeadPriority.HIGH;
    }

    // Urgent: both high budget AND large area
    if (highBudgets.includes(lead.budgetRange || '') && highAreas.includes(lead.approxArea || '')) {
      priority = LeadPriority.URGENT;
    }

    if (priority !== lead.priority) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { priority },
      });

      // Slack notification for high-priority
      if (priority === 'HIGH' || priority === 'URGENT') {
        await this.notifySlack(lead);
      }
    }
  }

  // ═══════════════════════════════════════
  // INTERNAL: City → Region mapping
  // ═══════════════════════════════════════
  private mapCityToRegion(city: string): Region {
    const map: Record<string, Region> = {
      'Mumbai': Region.WEST,
      'Pune': Region.WEST,
      'Ahmedabad': Region.WEST,
      'Delhi NCR / Gurugram / Noida': Region.NORTH,
      'Bangalore': Region.SOUTH,
      'Hyderabad': Region.SOUTH,
      'Chennai': Region.SOUTH,
      'Kolkata': Region.EAST,
      'Other / Multiple Cities': Region.PAN_INDIA,
    };
    return map[city] || Region.PAN_INDIA;
  }

  // ═══════════════════════════════════════
  // INTERNAL: CRM Sync
  // ═══════════════════════════════════════
  private async syncToCrm(leadId: string) {
    const provider = this.config.get('CRM_PROVIDER');
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    try {
      if (provider === 'hubspot') {
        // HubSpot API contact creation
        const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.get('HUBSPOT_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              firstname: lead.fullName.split(' ')[0],
              lastname: lead.fullName.split(' ').slice(1).join(' '),
              email: lead.email,
              phone: lead.phone,
              company: lead.company,
              city: lead.city,
              hs_lead_status: 'NEW',
            },
          }),
        });
        const data = await response.json();

        await this.prisma.lead.update({
          where: { id: leadId },
          data: { crmId: data.id, crmSyncedAt: new Date() },
        });
      } else if (provider === 'webhook') {
        // Generic webhook
        await fetch(this.config.get('CRM_WEBHOOK_URL')!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': this.config.get('CRM_WEBHOOK_SECRET') || '',
          },
          body: JSON.stringify({ event: 'lead.created', data: lead }),
        });
        await this.prisma.lead.update({
          where: { id: leadId },
          data: { crmSyncedAt: new Date() },
        });
      }
    } catch (err) {
      this.logger.error(`CRM sync failed for lead ${leadId}`, err);
    }
  }

  // ═══════════════════════════════════════
  // INTERNAL: Slack notification
  // ═══════════════════════════════════════
  private async notifySlack(lead: any) {
    const webhookUrl = this.config.get('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔥 *High-Priority Lead*\n*${lead.fullName}* (${lead.company || 'N/A'})\n${lead.city || ''} · ${lead.budgetRange || ''} · ${lead.approxArea || ''}\n📧 ${lead.email} · 📞 ${lead.phone}`,
        }),
      });
    } catch (err) {
      this.logger.error('Slack notification failed', err);
    }
  }

  private async findOrFail(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
