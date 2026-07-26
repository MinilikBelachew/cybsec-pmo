import { Client } from "pg";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Parse backend .env for JWT only; DB URL targets Docker Postgres published on the host.
const backendEnvPath = path.resolve(__dirname, "../../../backend/.env");

/** docker-compose.dev.yml: postgres published as host localhost:5435, password m123 */
const DOCKER_HOST_DATABASE_URL =
  "postgresql://postgres:m123@127.0.0.1:5435/cybsec_pmo?schema=public";

let jwtSecret = "secret";
let databaseUrl =
  process.env.PLAYWRIGHT_DATABASE_URL || DOCKER_HOST_DATABASE_URL;

if (fs.existsSync(backendEnvPath)) {
  const envContent = fs.readFileSync(backendEnvPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let val = match[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === "AUTH_JWT_SECRET") {
      jwtSecret = val;
    }
    // Intentionally ignore DATABASE_URL from backend/.env when running Playwright
    // on the host against Docker: .env often points at localhost:5432 with a
    // different password than the compose Postgres (m123 on :5435).
  }
}

export async function getDbClient(): Promise<Client> {
  const client = new Client({
    connectionString: databaseUrl,
  });
  try {
    await client.connect();
  } catch (error: any) {
    const hint =
      "E2E DB connection failed. With Docker Compose running, Playwright expects Postgres at:\n" +
      `  ${DOCKER_HOST_DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}\n` +
      "  docker compose -f docker-compose.dev.yml up -d postgres\n" +
      "Override with PLAYWRIGHT_DATABASE_URL if needed.\n" +
      `Tried: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`;
    if (
      error?.code === "ECONNREFUSED" ||
      error?.code === "28P01" ||
      error?.message?.includes("password authentication failed") ||
      error?.name === "AggregateError" ||
      (Array.isArray(error?.errors) &&
        error.errors.some(
          (e: any) =>
            e?.code === "ECONNREFUSED" || e?.code === "28P01",
        ))
    ) {
      throw new Error(hint, { cause: error });
    }
    throw error;
  }
  return client;
}

export interface TestSessionResult {
  token: string;
  userId: string;
  roleCode: string;
  displayName: string;
}

export async function createTestSession(
  email: string,
  isBreakGlass: boolean = false,
  breakGlassReason: string | null = null
): Promise<TestSessionResult> {
  const client = await getDbClient();
  try {
    // 1. Fetch user and their role
    const userRes = await client.query(
      `SELECT u.id, u.display_name, u.role_id, r.code as role_code, u.is_external 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      throw new Error(`User with email ${email} not found in database.`);
    }

    const user = userRes.rows[0];

    // 2. Create session data
    const sessionId = crypto.randomUUID();
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(crypto.randomBytes(32))
      .digest("hex");

    // Set expiration to 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 3. Insert session into database
    await client.query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, is_break_glass, break_glass_reason, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        sessionId,
        user.id,
        refreshTokenHash,
        expiresAt,
        isBreakGlass,
        breakGlassReason,
      ]
    );

    // 4. Sign JWT token matching NestJS format
    const jwtPayload = {
      id: user.id,
      roleId: user.role_id,
      role: {
        id: user.role_id,
        code: user.role_code,
      },
      sessionId: sessionId,
      ...(user.is_external ? { isExternal: true } : {}),
      ...(isBreakGlass ? { breakGlass: true } : {}),
    };

    const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: "1h" });

    return {
      token,
      userId: user.id,
      roleCode: user.role_code,
      displayName: user.display_name,
    };
  } finally {
    await client.end();
  }
}

export async function clearTestSessions(userId: string): Promise<void> {
  const client = await getDbClient();
  try {
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  } finally {
    await client.end();
  }
}
