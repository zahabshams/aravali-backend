import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController, AdminLeadsController } from './leads.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [LeadsController, AdminLeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
