import express, { type Request, type Response } from 'express';
import passport from 'passport';
import { generateToken } from '../lib/jwt';
import { COOKIE_NAME, cookieOptions, clearCookieOptions } from '../lib/cookie';
import { authenticateJWT, type AuthRequest } from '../middleware/auth';
import type { User } from '@prisma/client';

// Import strategies to register them
import '../auth/google';
import '../auth/discord';

const router = express.Router();

const CLIENT_ORIGIN_DEV = process.env.CLIENT_ORIGIN_DEV || 'http://localhost:5173';
const CLIENT_ORIGIN_PROD = process.env.CLIENT_ORIGIN_PROD || 'https://gvicarvalho.github.io';
const isProduction = process.env.NODE_ENV === 'production';
const CLIENT_ORIGIN = isProduction ? CLIENT_ORIGIN_PROD : CLIENT_ORIGIN_DEV;

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${CLIENT_ORIGIN}?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as User;
    if (!user) {
      res.redirect(`${CLIENT_ORIGIN}?error=no_user`);
      return;
    }

    const token = generateToken({
      userId: user.id,
      provider: user.provider,
      displayName: user.displayName,
    });

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.redirect(`${CLIENT_ORIGIN}?auth=success`);
  }
);

// Discord OAuth routes
router.get(
  '/discord',
  passport.authenticate('discord', {
    session: false,
  })
);

router.get(
  '/discord/callback',
  passport.authenticate('discord', { session: false, failureRedirect: `${CLIENT_ORIGIN}?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as User;
    if (!user) {
      res.redirect(`${CLIENT_ORIGIN}?error=no_user`);
      return;
    }

    const token = generateToken({
      userId: user.id,
      provider: user.provider,
      displayName: user.displayName,
    });

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.redirect(`${CLIENT_ORIGIN}?auth=success`);
  }
);

// Get current user info
router.get('/me', authenticateJWT, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  res.json({
    userId: req.user.userId,
    provider: req.user.provider,
    displayName: req.user.displayName,
  });
});

// Logout
router.post('/logout', (_req: Request, res: Response) => {
  res.cookie(COOKIE_NAME, '', clearCookieOptions());
  res.json({ success: true });
});

export default router;
