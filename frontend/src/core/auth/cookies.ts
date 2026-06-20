import { cookies } from "next/headers";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const cookieStore = {
  getAccessToken: async () => {
    const jar = await cookies();
    return jar.get(ACCESS_TOKEN_KEY)?.value ?? null;
  },

  getRefreshToken: async () => {
    const jar = await cookies();
    return jar.get(REFRESH_TOKEN_KEY)?.value ?? null;
  },

  setTokens: async (accessToken: string, refreshToken: string) => {
    const jar = await cookies();
    jar.set(ACCESS_TOKEN_KEY, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour
    });
    jar.set(REFRESH_TOKEN_KEY, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  },

  clearTokens: async () => {
    const jar = await cookies();
    jar.delete(ACCESS_TOKEN_KEY);
    jar.delete(REFRESH_TOKEN_KEY);
  },
};
