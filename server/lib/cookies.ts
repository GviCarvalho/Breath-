import type { IncomingMessage } from 'http';

export function parseCookies(request: IncomingMessage): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}
