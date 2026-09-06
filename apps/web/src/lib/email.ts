import nodemailer from 'nodemailer';
import { readAuthEnvironment } from '@trip-planner/config';

export async function sendMagicLink(email: string, url: string) {
  const environment = readAuthEnvironment();
  if (!environment.SMTP_URL || !environment.EMAIL_FROM) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Email delivery is not configured.');
    console.info(`Magic link for ${email}: ${url}`);
    return;
  }
  await nodemailer.createTransport(environment.SMTP_URL).sendMail({
    from: environment.EMAIL_FROM,
    to: email,
    subject: 'Your Roamly recovery link',
    text: `Sign in to Roamly. This single-use link expires in 10 minutes:\n\n${url}`,
  });
}
