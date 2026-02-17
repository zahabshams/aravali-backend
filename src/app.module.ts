import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './config/prisma.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { BlogModule } from './blog/blog.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './email/email.module';
import { FilesModule } from './files/files.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [
    // ── Config ──
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate Limiting ──
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.THROTTLE_TTL || '3600') * 1000,
      limit: parseInt(process.env.THROTTLE_LIMIT || '60'),
    }]),

    // ── Scheduled Tasks ──
    ScheduleModule.forRoot(),

    // ── Infrastructure ──
    PrismaModule,
    RedisModule,

    // ── Feature Modules ──
    AuthModule,
    LeadsModule,
    PortfolioModule,
    BlogModule,
    AdminModule,
    EmailModule,
    FilesModule,
    CalendarModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
