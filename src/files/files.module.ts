import {
  Injectable, Module, Controller, Post, Param, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as AWS from 'aws-sdk';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/dwg', 'application/dxf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FilesService {
  private s3: AWS.S3;
  private bucket: string;
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.s3 = new AWS.S3({
      region: this.config.get('AWS_REGION', 'ap-south-1'),
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
    });
    this.bucket = this.config.get('S3_BUCKET_NAME', 'aravali-uploads');
  }

  async uploadLeadAttachment(leadId: string, file: Express.Multer.File) {
    // Validate
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} not allowed`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Upload to S3
    const key = `leads/${leadId}/${randomUUID()}-${file.originalname}`;
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: { 'lead-id': leadId },
    }).promise();

    // Save metadata to DB
    const attachment = await this.prisma.leadAttachment.create({
      data: {
        leadId,
        fileName: file.originalname,
        fileKey: key,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
      },
    });

    // TODO: Queue virus scan via Lambda/SQS
    this.logger.log(`File uploaded: ${key} for lead ${leadId}`);

    return attachment;
  }

  async getSignedUrl(fileKey: string): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: fileKey,
      Expires: 3600, // 1 hour
    });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/leads')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment to lead' })
  async upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.filesService.uploadLeadAttachment(id, file);
  }
}

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
