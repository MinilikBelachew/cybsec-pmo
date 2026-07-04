import { Client } from "pg";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Parse backend .env for configuration
const backendEnvPath = path.resolve(__dirname, "../../../../backend/.env");
let jwtSecret = "secret";
let databaseUrl = "postgresql://postgres:m123@localhost:5435/cybsec_pmo?schema=public";

if (fs.existsSync(backendEnvPath)) {
  const envContent = fs.readFileSync(backendEnvPath, "utf-8");
  const envLines = envContent.split("\n");
  for (const line of envLines) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      // Remove quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      if (key === "AUTH_JWT_SECRET") {
        jwtSecret = val;
      } else if (key === "DATABASE_URL") {
        databaseUrl = val;
      }
    }
  }
}

// Map localhost:5435 if running on host mac
// If database url contains "postgres" as host (from docker network), replace it with localhost
if (databaseUrl.includes("@postgres:")) {
  databaseUrl = databaseUrl.replace("@postgres:", "@localhost:");
}
// Keep port mapped port (exposed as 5435 in docker-compose)
if (databaseUrl.includes(":5432/")) {
  databaseUrl = databaseUrl.replace(":5432/", ":5435/");
}

export async function getDbClient(): Promise<Client> {
  const client = new Client({
    connectionString: databaseUrl,
  });
  await client.connect();
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
      [sessionId, user.id, refreshTokenHash, expiresAt, isBreakGlass, breakGlassReason]
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
