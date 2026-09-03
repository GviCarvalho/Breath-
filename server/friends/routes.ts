import express, { type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { authenticateJWT, type AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Excludes visually ambiguous characters (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateFriendCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

async function ensureFriendCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.friendCode) return user.friendCode;

  // Collisions are astronomically unlikely at this user count, but the
  // unique constraint means a retry is cheap insurance either way.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode();
    try {
      const updated = await prisma.user.update({ where: { id: userId }, data: { friendCode: code } });
      return updated.friendCode!;
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }
  }
  throw new Error('Não foi possível gerar um código de amigo.');
}

router.use((req, res, next) => {
  if (!prisma) {
    res.status(503).json({ error: 'Servidor sem banco de dados configurado.' });
    return;
  }
  next();
});

router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const friendCode = await ensureFriendCode(userId);

    const [accepted, incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: { requester: true, addressee: true },
      }),
      prisma.friendship.findMany({
        where: { status: 'pending', addresseeId: userId },
        include: { requester: true },
      }),
      prisma.friendship.findMany({
        where: { status: 'pending', requesterId: userId },
        include: { addressee: true },
      }),
    ]);

    const friends = accepted.map((f) => {
      const other = f.requesterId === userId ? f.addressee : f.requester;
      return { friendshipId: f.id, userId: other.id, displayName: other.displayName, avatarUrl: other.avatarUrl };
    });

    res.json({
      friendCode,
      friends,
      incomingRequests: incoming.map((f) => ({
        friendshipId: f.id,
        userId: f.requester.id,
        displayName: f.requester.displayName,
      })),
      outgoingRequests: outgoing.map((f) => ({
        friendshipId: f.id,
        userId: f.addressee.id,
        displayName: f.addressee.displayName,
      })),
    });
  } catch (error) {
    console.error('[friends] list failed', error);
    res.status(500).json({ error: 'Não foi possível carregar seus amigos.' });
  }
});

router.post('/request', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (!code) {
    res.status(400).json({ error: 'Informe um código de amigo.' });
    return;
  }

  try {
    const target = await prisma.user.findUnique({ where: { friendCode: code } });
    if (!target) {
      res.status(404).json({ error: 'Nenhum jogador encontrado com esse código.' });
      return;
    }
    if (target.id === userId) {
      res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });
      return;
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    });

    if (existing?.status === 'accepted') {
      res.status(409).json({ error: 'Vocês já são amigos.' });
      return;
    }

    // They already sent us a request - accept it instead of creating a
    // second, opposite-direction pending row.
    if (existing?.status === 'pending' && existing.requesterId === target.id) {
      const updated = await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted' } });
      res.json({ status: 'accepted', friendshipId: updated.id });
      return;
    }

    if (existing?.status === 'pending') {
      res.status(409).json({ error: 'Pedido já enviado.' });
      return;
    }

    const created = await prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id, status: 'pending' },
    });
    res.json({ status: 'pending', friendshipId: created.id });
  } catch (error) {
    console.error('[friends] request failed', error);
    res.status(500).json({ error: 'Não foi possível enviar o pedido.' });
  }
});

router.post('/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship || friendship.addresseeId !== userId || friendship.status !== 'pending') {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }
    await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'accepted' } });
    res.json({ success: true });
  } catch (error) {
    console.error('[friends] accept failed', error);
    res.status(500).json({ error: 'Não foi possível aceitar o pedido.' });
  }
});

router.post('/:id/decline', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship || friendship.addresseeId !== userId || friendship.status !== 'pending') {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }
    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[friends] decline failed', error);
    res.status(500).json({ error: 'Não foi possível recusar o pedido.' });
  }
});

router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  try {
    const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!friendship || (friendship.requesterId !== userId && friendship.addresseeId !== userId)) {
      res.status(404).json({ error: 'Amizade não encontrada.' });
      return;
    }
    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[friends] remove failed', error);
    res.status(500).json({ error: 'Não foi possível remover.' });
  }
});

export default router;
