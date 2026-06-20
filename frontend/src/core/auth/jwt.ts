import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-use-a-strong-secret-in-production"
);

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export async function signJwt(payload: JwtPayload, expiresIn = "1h"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
