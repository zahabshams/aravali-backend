import {
  IsString, IsEmail, IsOptional, IsEnum, IsDateString,
  IsNotEmpty, MinLength, MaxLength, IsInt, Min, Max, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Step 1: Core info (required) ──
export class CreateLeadDto {
  @ApiProperty({ example: 'Rajesh Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ example: 'Acme India Pvt Ltd' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  company?: string;

  @ApiProperty({ example: 'rajesh@acme.in' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'Invalid phone number format' })
  phone: string;

  @ApiPropertyOptional({ example: 'Corporate Office / Headquarters' })
  @IsString()
  @IsOptional()
  projectType?: string;
}

// ── Step 2: Project details ──
export class UpdateLeadStep2Dto {
  @ApiPropertyOptional({ example: '30,000 – 75,000 sq ft' })
  @IsString()
  @IsOptional()
  approxArea?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: '₹15 – 50 Crore' })
  @IsString()
  @IsOptional()
  budgetRange?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsDateString()
  @IsOptional()
  preferredStart?: string;
}

// ── Step 3: Additional ──
export class UpdateLeadStep3Dto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  additionalDetails?: string;

  @ApiPropertyOptional({ example: 'Google Search' })
  @IsString()
  @IsOptional()
  referralSource?: string;
}

// ── Admin: Update lead status/assignment ──
export class UpdateLeadAdminDto {
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'])
  @IsOptional()
  status?: string;

  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsOptional()
  tags?: string[];
}

// ── Query filters for admin lead list ──
export class LeadQueryDto {
  @IsOptional()
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'])
  status?: string;

  @IsOptional()
  @IsEnum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: string;

  @IsOptional()
  @IsEnum(['WEST', 'NORTH', 'SOUTH', 'EAST', 'PAN_INDIA'])
  region?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ── Add note ──
export class CreateLeadNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
