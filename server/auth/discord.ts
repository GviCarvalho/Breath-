import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { prisma } from '../lib/prisma';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || 'http://localhost:3001/auth/discord/callback';

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.warn('[auth] Discord OAuth credentials not configured');
}

passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
      scope: ['identify'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Find or create user
        let user = await prisma.user.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'discord',
              providerAccountId: profile.id,
            },
          },
        });

        if (!user) {
          const avatarUrl = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;

          user = await prisma.user.create({
            data: {
              provider: 'discord',
              providerAccountId: profile.id,
              displayName: profile.username || 'Discord User',
              avatarUrl,
            },
          });
        } else {
          // Update user info
          const avatarUrl = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : user.avatarUrl;

          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              displayName: profile.username || user.displayName,
              avatarUrl,
            },
          });
        }

        done(null, user);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  )
);

export default passport;
