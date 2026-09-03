import express, { type Request, type Response } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { generateToken } from '../lib/jwt';
import { COOKIE_NAME, cookieOptions, clearCookieOptions } from '../lib/cookie';
import { authenticateJWT, type AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
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

const MIN_PASSWORD_LENGTH = 6;

// Local (email + password) account creation. Issues the exact same JWT
// cookie the OAuth callbacks do, so everything downstream (authenticateJWT,
// the WS upgrade handshake) already works with it unchanged.
router.post('/register', async (req: Request, res: Response) => {
  if (!prisma) {
    res.status(503).json({ error: 'Servidor sem banco de dados configurado.' });
    return;
  }

  const { email, password, displayName } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ error: 'Já existe uma conta com esse email.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        provider: 'local',
        email: normalizedEmail,
        passwordHash,
        displayName: (typeof displayName === 'string' && displayName.trim()) || normalizedEmail,
      },
    });

    const token = generateToken({ userId: user.id, provider: user.provider, displayName: user.displayName });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ userId: user.id, provider: user.provider, displayName: user.displayName });
  } catch (error) {
    console.error('[auth] register failed', error);
    res.status(500).json({ error: 'Não foi possível criar a conta.' });
  }
});

// Local (email + password) login.
router.post('/login', async (req: Request, res: Response) => {
  if (!prisma) {
    res.status(503).json({ error: 'Servidor sem banco de dados configurado.' });
    return;
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const token = generateToken({ userId: user.id, provider: user.provider, displayName: user.displayName });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ userId: user.id, provider: user.provider, displayName: user.displayName });
  } catch (error) {
    console.error('[auth] login failed', error);
    res.status(500).json({ error: 'Não foi possível entrar.' });
  }
});

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
