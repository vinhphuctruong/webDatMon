import nodemailer from "nodemailer";
import { env } from "../config/env";

type SendOtpEmailInput = {
  toEmail: string;
  otpCode: string;
  expiresInSeconds: number;
};

type SendOtpEmailResult = {
  sent: boolean;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function isGmailOtpConfigured() {
  return Boolean(env.GOOGLE_SMTP_USER && env.GOOGLE_SMTP_APP_PASSWORD);
}

function getTransporter() {
  if (!isGmailOtpConfigured()) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: env.GOOGLE_SMTP_USER,
      pass: env.GOOGLE_SMTP_APP_PASSWORD,
    },
  });

  return cachedTransporter;
}

export async function sendOtpEmail(input: SendOtpEmailInput): Promise<SendOtpEmailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false };
  }

  const expiresInMinutes = Math.max(1, Math.ceil(input.expiresInSeconds / 60));
  const fromAddress = env.OTP_EMAIL_FROM_ADDRESS || env.GOOGLE_SMTP_USER;
  const fromName = env.OTP_EMAIL_FROM_NAME;
  const from = fromAddress ? `"${fromName}" <${fromAddress}>` : fromName;

  await transporter.sendMail({
    from,
    to: input.toEmail,
    subject: `Ma OTP xac nhan dang ky - ${fromName}`,
    text: `Ma OTP cua ban la ${input.otpCode}. Ma co hieu luc trong ${expiresInMinutes} phut.`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#1f2937; line-height:1.5;">
        <h2 style="margin:0 0 12px;">Xac nhan email dang ky</h2>
        <p>Ma OTP cua ban la:</p>
        <div style="display:inline-block; font-size:24px; letter-spacing:4px; font-weight:700; padding:8px 12px; border:1px dashed #16a34a; border-radius:8px;">
          ${input.otpCode}
        </div>
        <p style="margin-top:12px;">Ma co hieu luc trong <strong>${expiresInMinutes} phut</strong>.</p>
        <p style="margin-top:12px; font-size:12px; color:#6b7280;">Neu ban khong yeu cau ma nay, vui long bo qua email.</p>
      </div>
    `,
  });

  return { sent: true };
}
