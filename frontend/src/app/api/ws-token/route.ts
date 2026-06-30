import { cookies } from "next/headers";

const ACCESS_TOKEN_COOKIE = "access_token";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ token });
}
