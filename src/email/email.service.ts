import got from 'got';
import * as FormData from 'form-data';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS } from 'src/common/common.constants';
import { EmailModuleOptions, EmailVar } from './email.interface';

@Injectable()
export class EmailService {
  constructor(
    @Inject(CONFIG_OPTIONS) private readonly options: EmailModuleOptions,
  ) {}
  private async sendEmail(
    subject: string,
    template: string,
    emailVars: EmailVar[],
  ) {
    const form = new FormData();
    form.append(
      'from',
      `Nico from Nuber Eats <mailgun@${this.options.domain}>`,
    );
    form.append('to', '012h21l@gmail.com');
    form.append('subject', subject);
    form.append('template', template);
    emailVars.forEach((eVar) => form.append(`v:${eVar.key}`, eVar.value));
    try {
      await got(`https://api.mailgun.net/v3/${this.options.domain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `api:${this.options.apiKey}`,
          ).toString('base64')}`,
        },
        body: form,
      });
    } catch (err) {
      console.log(err);
    }
  }

  sendVerificationEmail(email: string, code: string) {
    this.sendEmail('Verify Your Email', 'confirm_email', [
      { key: 'code', value: code },
      { key: 'username', value: email },
    ]);
  }
}
