import NextAuth from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const handler = NextAuth(authOptions);

type Context = { params: { nextauth: string[] } };

const SESSION_COOKIES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

/**
 * NextAuth links a new Google account to whoever is still signed in, so signing in as B in a browser that still
 * has A's session made B open A's account for good. Ending the old session before the callback runs makes every
 * Google sign-in land on the account that was actually chosen.
 */
async function GET(request: Request, context: Context) {
  if (context.params.nextauth[0] === "callback") {
    const tokens = SESSION_COOKIES.map((name) => cookies().get(name)?.value).filter((value): value is string => Boolean(value));
    if (tokens.length > 0) await prisma.session.deleteMany({ where: { sessionToken: { in: tokens } } });
  }
  return handler(request, context);
}

export { GET, handler as POST };
