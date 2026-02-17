import {
  Injectable, Module, Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../config/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

// ── DTOs ──
class PortfolioQueryDto {
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() sustainable?: string; // 'true' for green-certified only
  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 12;
}

class CreatePortfolioDto {
  @IsString() title: string;
  @IsString() slug: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() sector?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) areaSqft?: number;
  @IsOptional() @IsString() budgetDisplay?: string;
  @IsOptional() @Type(() => Number) durationMonths?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() challenge?: string;
  @IsOptional() @IsString() solution?: string;
  @IsOptional() @IsString() impact?: string;
  @IsOptional() sustainability?: any;
  @IsOptional() images?: any;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() published?: boolean;
}

// ── Service ──
@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PortfolioQueryDto) {
    const where: any = { published: true };
    if (query.sector) where.sector = query.sector;
    if (query.city) where.city = query.city;
    if (query.sustainable === 'true') {
      where.sustainability = { not: null };
    }

    const [data, total] = await Promise.all([
      this.prisma.portfolioProject.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: ((query.page || 1) - 1) * (query.limit || 12),
        take: query.limit || 12,
      }),
      this.prisma.portfolioProject.count({ where }),
    ]);

    return { data, meta: { total, page: query.page, totalPages: Math.ceil(total / (query.limit || 12)) } };
  }

  async findBySlug(slug: string) {
    const project = await this.prisma.portfolioProject.findUnique({ where: { slug } });
    if (!project || !project.published) throw new NotFoundException('Project not found');
    return project;
  }

  async adminCreate(dto: CreatePortfolioDto) {
    return this.prisma.portfolioProject.create({ data: dto as any });
  }

  async adminUpdate(id: string, dto: Partial<CreatePortfolioDto>) {
    return this.prisma.portfolioProject.update({ where: { id }, data: dto as any });
  }

  async adminDelete(id: string) {
    return this.prisma.portfolioProject.delete({ where: { id } });
  }

  async getSectors() {
    const sectors = await this.prisma.portfolioProject.findMany({
      where: { published: true },
      select: { sector: true },
      distinct: ['sector'],
    });
    return sectors.map(s => s.sector).filter(Boolean);
  }

  async getCities() {
    const cities = await this.prisma.portfolioProject.findMany({
      where: { published: true },
      select: { city: true },
      distinct: ['city'],
    });
    return cities.map(c => c.city).filter(Boolean);
  }
}

// ── Public Controller ──
@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private svc: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'List published projects (filterable)' })
  findAll(@Query() query: PortfolioQueryDto) { return this.svc.findAll(query); }

  @Get('filters')
  @ApiOperation({ summary: 'Get available filter options' })
  async filters() {
    const [sectors, cities] = await Promise.all([this.svc.getSectors(), this.svc.getCities()]);
    return { sectors, cities };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Project detail by slug' })
  findOne(@Param('slug') slug: string) { return this.svc.findBySlug(slug); }
}

// ── Admin Controller ──
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPortfolioController {
  constructor(private svc: PortfolioService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create portfolio project' })
  create(@Body() dto: CreatePortfolioDto) { return this.svc.adminCreate(dto); }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update portfolio project' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePortfolioDto>) { return this.svc.adminUpdate(id, dto); }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete portfolio project' })
  remove(@Param('id') id: string) { return this.svc.adminDelete(id); }
}

@Module({
  controllers: [PortfolioController, AdminPortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
