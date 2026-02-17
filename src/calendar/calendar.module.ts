import {
  Injectable, Module, Controller, Post, Get, Body, Query,
  BadRequestException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsDateString } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.module';
import { EmailService } from '../email/email.service';

class AvailableSlotsDto {
  @IsDateString() date: string; // YYYY-MM-DD
}

class CreateBookingDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;
  @IsDateString() startTime: string;  // ISO 8601
  @IsDateString() endTime: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  async getAvailableSlots(date: string) {
    const dayStart = new Date(`${date}T00:00:00+05:30`);
    const dayEnd = new Date(`${date}T23:59:59+05:30`);

    // Get existing bookings for the day
    const booked = await this.prisma.calendarBooking.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        cancelled: false,
      },
      select: { startTime: true, endTime: true },
    });

    // Generate 30-min slots from 10:00 to 18:00 IST
    const slots: { start: string; end: string; available: boolean }[] = [];
    for (let hour = 10; hour < 18; hour++) {
      for (const min of [0, 30]) {
        const start = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+05:30`);
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        const isBooked = booked.some(b =>
          start < new Date(b.endTime) && end > new Date(b.startTime),
        );

        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          available: !isBooked,
        });
      }
    }

    return { date, timezone: 'Asia/Kolkata', slots };
  }

  async createBooking(dto: CreateBookingDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    // Validate: not in the past, within business hours
    if (start < new Date()) throw new BadRequestException('Cannot book in the past');
    if (end.getTime() - start.getTime() < 15 * 60 * 1000) {
      throw new BadRequestException('Minimum booking duration is 15 minutes');
    }

    // Check conflicts
    const conflict = await this.prisma.calendarBooking.findFirst({
      where: {
        cancelled: false,
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (conflict) throw new BadRequestException('This time slot is no longer available');

    // Create booking
    const booking = await this.prisma.calendarBooking.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        notes: dto.notes,
        startTime: start,
        endTime: end,
      },
    });

    // TODO: Create Google Calendar event via API
    // await this.createGoogleCalendarEvent(booking);

    // Send confirmation email
    this.logger.log(`Booking created: ${booking.id} for ${dto.email}`);

    return {
      id: booking.id,
      message: 'Booking confirmed. You will receive a calendar invite shortly.',
    };
  }
}

@ApiTags('calendar')
@Controller('booking')
export class CalendarController {
  constructor(private svc: CalendarService) {}

  @Get('slots')
  @ApiOperation({ summary: 'Get available booking slots for a date' })
  getSlots(@Query() q: AvailableSlotsDto) { return this.svc.getAvailableSlots(q.date); }

  @Post()
  @ApiOperation({ summary: 'Create a consultation booking' })
  create(@Body() dto: CreateBookingDto) { return this.svc.createBooking(dto); }
}

@Module({
  imports: [],
  controllers: [CalendarController],
  providers: [CalendarService, EmailService],
  exports: [CalendarService],
})
export class CalendarModule {}
