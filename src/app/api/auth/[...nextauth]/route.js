import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL;

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account.provider === 'google') {
        return profile.email === ALLOWED_EMAIL;
      }
      return false;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
