import { Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private sgMail: any;

  constructor(private config: ConfigService) {
    try {
      this.sgMail = require('@sendgrid/mail');
      this.sgMail.setApiKey(this.config.get('SENDGRID_API_KEY'));
    } catch {
      this.logger.warn('SendGrid not configured — emails will be logged only');
    }
  }

  async sendLeadConfirmation(
    to: string,
    name: string,
    data: { company?: string; projectType?: string; resumeUrl: string },
  ) {
    const html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#151B25">
        <div style="background:#0B0F15;padding:2rem;text-align:center">
          <h1 style="color:#D4AA3C;font-size:1.4rem;font-weight:500;margin:0">Aravali Interiors</h1>
          <p style="color:#7A8799;font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;margin:.3rem 0 0">Commercial Design & Build Since 1998</p>
        </div>
        <div style="padding:2.5rem 2rem;background:#FBFAF7">
          <p style="font-size:1.1rem;color:#151B25">Dear ${name},</p>
          <p style="color:#4F5D73;line-height:1.8">Thank you for reaching out to Aravali Interiors. We've received your enquiry and our team will respond with a tailored feasibility brief within <strong>48 hours</strong>.</p>
          <div style="background:#F4F1EC;border-left:3px solid #9E7A2F;padding:1.2rem 1.5rem;margin:1.5rem 0">
            <p style="margin:0;font-size:.9rem;color:#4F5D73"><strong>Project Summary</strong></p>
            ${data.company ? `<p style="margin:.3rem 0 0;font-size:.9rem;color:#4F5D73">Company: ${data.company}</p>` : ''}
            ${data.projectType ? `<p style="margin:.3rem 0 0;font-size:.9rem;color:#4F5D73">Type: ${data.projectType}</p>` : ''}
          </div>
          <p style="color:#4F5D73;line-height:1.8">If you'd like to add more details to help us prepare a more accurate proposal, you can continue your enquiry here:</p>
          <div style="text-align:center;margin:1.5rem 0">
            <a href="${data.resumeUrl}" style="display:inline-block;background:#9E7A2F;color:#fff;padding:.8rem 2rem;font-size:.8rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Complete Your Enquiry</a>
          </div>
          <p style="color:#7A8799;font-size:.85rem;line-height:1.7">For urgent requirements, call us at <strong>+91 22 6800 0100</strong> or reply to this email.</p>
        </div>
        <div style="background:#0B0F15;padding:1.5rem 2rem;text-align:center">
          <p style="color:#4F5D73;font-size:.75rem;margin:0">© 2026 Aravali Interiors Pvt. Ltd. | Mumbai · Delhi · Bangalore · Hyderabad · Chennai · Pune</p>
        </div>
      </div>
    `;

    await this.send(to, 'Thank you for your enquiry — Aravali Interiors', html);
  }

  async sendResumeLink(to: string, name: string, resumeUrl: string) {
    const html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:2rem;background:#FBFAF7;color:#151B25">
        <p>Hi ${name},</p>
        <p style="color:#4F5D73">Here's your link to continue your project enquiry:</p>
        <div style="text-align:center;margin:1.5rem 0">
          <a href="${resumeUrl}" style="display:inline-block;background:#9E7A2F;color:#fff;padding:.8rem 2rem;font-size:.8rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none">Continue Enquiry</a>
        </div>
        <p style="color:#7A8799;font-size:.85rem">This link expires in 7 days.</p>
      </div>
    `;
    await this.send(to, 'Continue your enquiry — Aravali Interiors', html);
  }

  private async send(to: string, subject: string, html: string) {
    const from = {
      email: this.config.get('SENDGRID_FROM_EMAIL', 'projects@aravali.in'),
      name: this.config.get('SENDGRID_FROM_NAME', 'Aravali Interiors'),
    };

    if (this.sgMail) {
      try {
        await this.sgMail.send({ to, from, subject, html });
        this.logger.log(`Email sent to ${to}: ${subject}`);
      } catch (err: any) {
        this.logger.error(`Email failed to ${to}`, err?.response?.body || err);
      }
    } else {
      this.logger.log(`[DEV] Email to ${to}: ${subject}`);
    }
  }
}

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
