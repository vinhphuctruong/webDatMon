type OtpIssueResult = {
  code: string;
  expiresInSeconds: number;
  retryAfterSeconds: number;
};

type OtpVerifyResult =
  | { ok: true }
  | { ok: false; message: string };

interface EmailOtpRecord {
  code: string;
  expiresAt: number;
  retryAfterAt: number;
  attemptsLeft: number;
}

const EMAIL_OTP_LENGTH = 6;
const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
const EMAIL_OTP_RETRY_MS = 60 * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

const otpByEmail = new Map<string, EmailOtpRecord>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function randomNumericCode(length: number) {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function pruneExpired() {
  const now = Date.now();
  for (const [email, record] of otpByEmail.entries()) {
    if (record.expiresAt <= now) {
      otpByEmail.delete(email);
    }
  }
}

export function issueEmailOtp(email: string): OtpIssueResult {
  pruneExpired();
  const normalized = normalizeEmail(email);
  const now = Date.now();
  const existing = otpByEmail.get(normalized);

  if (existing && existing.retryAfterAt > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.retryAfterAt - now) / 1000),
    );
    return {
      code: existing.code,
      expiresInSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      retryAfterSeconds,
    };
  }

  const code = randomNumericCode(EMAIL_OTP_LENGTH);
  const record: EmailOtpRecord = {
    code,
    expiresAt: now + EMAIL_OTP_TTL_MS,
    retryAfterAt: now + EMAIL_OTP_RETRY_MS,
    attemptsLeft: EMAIL_OTP_MAX_ATTEMPTS,
  };

  otpByEmail.set(normalized, record);

  return {
    code,
    expiresInSeconds: Math.ceil(EMAIL_OTP_TTL_MS / 1000),
    retryAfterSeconds: Math.ceil(EMAIL_OTP_RETRY_MS / 1000),
  };
}

export function verifyEmailOtp(email: string, otpCode: string): OtpVerifyResult {
  pruneExpired();
  const normalized = normalizeEmail(email);
  const normalizedCode = otpCode.trim();
  const record = otpByEmail.get(normalized);

  if (!record) {
    return { ok: false, message: "OTP không tồn tại hoặc đã hết hạn" };
  }

  if (record.expiresAt <= Date.now()) {
    otpByEmail.delete(normalized);
    return { ok: false, message: "OTP đã hết hạn, vui lòng yêu cầu mã mới" };
  }

  if (record.code !== normalizedCode) {
    record.attemptsLeft -= 1;
    if (record.attemptsLeft <= 0) {
      otpByEmail.delete(normalized);
      return { ok: false, message: "OTP sai quá nhiều lần, vui lòng yêu cầu mã mới" };
    }
    otpByEmail.set(normalized, record);
    return { ok: false, message: `OTP không đúng (còn ${record.attemptsLeft} lần thử)` };
  }

  otpByEmail.delete(normalized);
  return { ok: true };
}

