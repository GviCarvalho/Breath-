import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { COOKIE_NAME } from '../lib/cookie';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    userId: string;
    provider: string;
    displayName: string;
  };
}

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  req.userId = payload.userId;
  req.user = payload;
  next();
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies[COOKIE_NAME];

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.userId = payload.userId;
      req.user = payload;
    }
  }

  next();
}
