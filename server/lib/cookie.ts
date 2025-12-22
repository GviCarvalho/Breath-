import type { CookieOptions } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const COOKIE_NAME = 'access_token';

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction, // Only send over HTTPS in production
  sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export function clearCookieOptions(): CookieOptions {
  return {
    ...cookieOptions,
    maxAge: 0,
  };
}
