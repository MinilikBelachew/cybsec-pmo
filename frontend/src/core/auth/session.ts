import { cookieStore } from "./cookies";
import { verifyJwt, type JwtPayload } from "./jwt";

export async function getSession(): Promise<JwtPayload | null> {
  const token = await cookieStore.getAccessToken();
  if (!token) return null;
  return verifyJwt(token);
}

export async function requireSession(): Promise<JwtPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthenticated");
  }
  return session;
}
