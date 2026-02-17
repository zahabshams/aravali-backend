import {
  Controller, Post, Get, Patch, Param, Body, Query,
  Ip, Res, UseGuards, Req, Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { LeadsService } from './leads.service';
import {
  CreateLeadDto, UpdateLeadStep2Dto, UpdateLeadStep3Dto,
  UpdateLeadAdminDto, LeadQueryDto, CreateLeadNoteDto,
} from './leads.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ═══ PUBLIC ENDPOINTS ═══

  @Post()
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  @ApiOperation({ summary: 'Submit new lead (Step 1)' })
  async create(@Body() dto: CreateLeadDto, @Ip() ip: string) {
    return this.leadsService.create(dto, ip);
  }

  @Patch(':id/step2')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Update lead with Step 2 data' })
  async updateStep2(@Param('id') id: string, @Body() dto: UpdateLeadStep2Dto) {
    return this.leadsService.updateStep2(id, dto);
  }

  @Patch(':id/step3')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Update lead with Step 3 data' })
  async updateStep3(@Param('id') id: string, @Body() dto: UpdateLeadStep3Dto) {
    return this.leadsService.updateStep3(id, dto);
  }

  @Get('resume/:token')
  @ApiOperation({ summary: 'Resume saved form via token' })
  async resume(@Param('token') token: string) {
    return this.leadsService.resumeByToken(token);
  }

  @Post(':id/resume-link')
  @ApiOperation({ summary: 'Send resume link to email' })
  async sendResumeLink(@Param('id') id: string) {
    return this.leadsService.sendResumeLink(id);
  }
}

// ═══ ADMIN LEAD ENDPOINTS (separate controller) ═══
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminLeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'SALES')
  @ApiOperation({ summary: 'List all leads (filterable, paginated)' })
  async findAll(@Query() query: LeadQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get('dashboard')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Dashboard KPIs' })
  async dashboard() {
    return this.leadsService.getDashboard();
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Export leads as CSV' })
  async exportCsv(@Query() query: LeadQueryDto, @Res() res: Response) {
    const csv = await this.leadsService.exportCsv(query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads-${Date.now()}.csv`);
    res.send(csv);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'SALES')
  @ApiOperation({ summary: 'Lead detail with notes & attachments' })
  async findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update lead status, assignment, tags' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadAdminDto,
    @Req() req: Request,
  ) {
    return this.leadsService.adminUpdate(id, dto, (req as any).user.id);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'MANAGER', 'SALES')
  @ApiOperation({ summary: 'Add note to lead' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: CreateLeadNoteDto,
    @Req() req: Request,
  ) {
    return this.leadsService.addNote(id, dto, (req as any).user.id);
  }
}
