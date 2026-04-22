import crypto from "node:crypto";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  tokenId: string;
}

function toMilliseconds(value: string): number {
  const pattern = /^(\d+)([smhd])$/i;
  const match = value.match(pattern);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * multipliers[unit];
}

export function accessTokenTtlMs() {
  return toMilliseconds(env.JWT_ACCESS_EXPIRES_IN);
}

export function refreshTokenTtlMs() {
  return toMilliseconds(env.JWT_REFRESH_EXPIRES_IN);
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: Math.floor(accessTokenTtlMs() / 1000),
  });
}

export function signRefreshToken(payload: RefreshTokenPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: Math.floor(refreshTokenTtlMs() / 1000),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
