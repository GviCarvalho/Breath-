import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('[auth] Google OAuth credentials not configured');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await prisma.user.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'google',
                providerAccountId: profile.id,
              },
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                provider: 'google',
                providerAccountId: profile.id,
                displayName: profile.displayName || profile.emails?.[0]?.value || 'Google User',
                avatarUrl: profile.photos?.[0]?.value || null,
              },
            });
          } else {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                displayName: profile.displayName || profile.emails?.[0]?.value || user.displayName,
                avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
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
}

export default passport;
