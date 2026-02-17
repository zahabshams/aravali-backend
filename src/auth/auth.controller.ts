import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() password: string;
}

class RefreshDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() password: string;
  @IsOptional() @IsEnum(['ADMIN', 'MANAGER', 'SALES', 'VIEWER']) role?: string;
  @IsOptional() @IsEnum(['WEST', 'NORTH', 'SOUTH', 'EAST', 'PAN_INDIA']) region?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Req() req: Request) {
    return (req as any).user;
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create admin user (admin only)' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }
}
