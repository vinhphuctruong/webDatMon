import nodemailer from 'nodemailer';
import env from '../config/env';

// Create a transporter using SMTP config from environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail', // Standard for Gmail apps
  auth: {
    user: process.env.GOOGLE_SMTP_USER || 'test@gmail.com',
    pass: process.env.GOOGLE_SMTP_APP_PASSWORD || 'testpass'
  }
});

// Function to send OTP email
export const sendOtpEmail = async (toEmail: string, otpCode: string, userName: string) => {
  const fromName = process.env.OTP_EMAIL_FROM_NAME || 'TM Food';
  const fromAddress = process.env.OTP_EMAIL_FROM_ADDRESS || process.env.GOOGLE_SMTP_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: '[TM Food] Mã xác nhận khôi phục mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #00b14f; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">TM Food</h2>
        </div>
        <div style="padding: 30px 20px; background-color: #fcfcfc;">
          <h3 style="color: #333; margin-top: 0;">Xin chào ${userName},</h3>
          <p style="color: #555; line-height: 1.5;">Bạn vừa yêu cầu khôi phục mật khẩu trên hệ thống TM Food.</p>
          <p style="color: #555; line-height: 1.5;">Đây là mã xác nhận OTP của bạn (có hiệu lực trong 10 phút):</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; padding: 15px 30px; background-color: #f0fdf4; color: #00b14f; font-size: 32px; font-weight: bold; border-radius: 8px; letter-spacing: 5px; border: 2px dashed #00b14f;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #555; line-height: 1.5; font-size: 14px;">Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này hoặc liên hệ hỗ trợ.</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; color: #888; font-size: 12px;">
          © ${new Date().getFullYear()} TM Food Platform. All rights reserved.
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    // If we fail to send email (due to invalid SMTP), at least log it in dev
    console.log(`[DEV FALLBACK] OTP for ${toEmail} is: ${otpCode}`);
    return false;
  }
};
