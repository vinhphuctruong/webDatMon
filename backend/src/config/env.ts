import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalEmail = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}, z.string().email().optional());

const optionalSecret = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}, z.string().min(8).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  API_PREFIX: z.string().default("/api/v1"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  GOOGLE_SMTP_USER: optionalEmail,
  GOOGLE_SMTP_APP_PASSWORD: optionalSecret,
  OTP_EMAIL_FROM_NAME: z.string().default("TM Food"),
  OTP_EMAIL_FROM_ADDRESS: optionalEmail,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
