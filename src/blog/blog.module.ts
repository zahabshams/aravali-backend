import {
  Injectable, Module, Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../config/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class BlogQueryDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 9;
}

class CreateBlogDto {
  @IsString() title: string;
  @IsString() slug: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsString() content: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsString() authorId: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
}

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: BlogQueryDto) {
    const where: any = { published: true };
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { publishedAt: 'desc' },
        skip: ((query.page || 1) - 1) * (query.limit || 9),
        take: query.limit || 9,
      }),
      this.prisma.blogPost.count({ where }),
    ]);

    return { data, meta: { total, page: query.page, totalPages: Math.ceil(total / (query.limit || 9)) } };
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!post || !post.published) throw new NotFoundException('Post not found');
    return post;
  }

  async getCategories() {
    const cats = await this.prisma.blogPost.findMany({
      where: { published: true },
      select: { category: true },
      distinct: ['category'],
    });
    return cats.map(c => c.category).filter(Boolean);
  }

  async adminCreate(dto: CreateBlogDto) {
    return this.prisma.blogPost.create({
      data: {
        ...dto,
        publishedAt: dto.published ? new Date() : undefined,
      } as any,
    });
  }

  async adminUpdate(id: string, dto: Partial<CreateBlogDto>) {
    const data: any = { ...dto };
    if (dto.published) data.publishedAt = new Date();
    return this.prisma.blogPost.update({ where: { id }, data });
  }

  async adminDelete(id: string) {
    return this.prisma.blogPost.delete({ where: { id } });
  }
}

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private svc: BlogService) {}

  @Get() @ApiOperation({ summary: 'List published posts' })
  findAll(@Query() q: BlogQueryDto) { return this.svc.findAll(q); }

  @Get('categories') @ApiOperation({ summary: 'Get blog categories' })
  categories() { return this.svc.getCategories(); }

  @Get(':slug') @ApiOperation({ summary: 'Post detail by slug' })
  findOne(@Param('slug') slug: string) { return this.svc.findBySlug(slug); }
}

@ApiTags('admin') @ApiBearerAuth()
@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminBlogController {
  constructor(private svc: BlogService) {}

  @Post() @Roles('ADMIN', 'MANAGER') @ApiOperation({ summary: 'Create blog post' })
  create(@Body() dto: CreateBlogDto) { return this.svc.adminCreate(dto); }

  @Patch(':id') @Roles('ADMIN', 'MANAGER') @ApiOperation({ summary: 'Update blog post' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateBlogDto>) { return this.svc.adminUpdate(id, dto); }

  @Delete(':id') @Roles('ADMIN') @ApiOperation({ summary: 'Delete blog post' })
  remove(@Param('id') id: string) { return this.svc.adminDelete(id); }
}

@Module({
  controllers: [BlogController, AdminBlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
