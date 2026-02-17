import { Module } from '@nestjs/common';

// Admin controllers are co-located with their feature modules:
// - AdminLeadsController  → leads/leads.controller.ts
// - AdminPortfolioController → portfolio/portfolio.module.ts
// - AdminBlogController → blog/blog.module.ts
// - FilesController → files/files.module.ts
//
// This module exists for any shared admin-only services (e.g. audit log viewer).

import { PrismaService } from '../config/prisma.module';
import { Injectable, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 50;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAuditLogs(query: AuditQueryDto) {
    const where: any = {};
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 50),
        take: query.limit || 50,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: { total, page: query.page, totalPages: Math.ceil(total / (query.limit || 50)) } };
  }

  async getUsers() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, region: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('audit-logs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'View audit logs' })
  auditLogs(@Query() q: AuditQueryDto) { return this.svc.getAuditLogs(q); }

  @Get('users')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List admin users' })
  users() { return this.svc.getUsers(); }
}

@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
