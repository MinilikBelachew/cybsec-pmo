import { AppError } from "./app-error";

export class AuthError extends AppError {
  constructor(message = "Authentication failed", code = "AUTH_ERROR") {
    super(message, code, 401);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", code = "FORBIDDEN") {
    super(message, code, 403);
    this.name = "ForbiddenError";
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super("Token has expired", "TOKEN_EXPIRED");
    this.name = "TokenExpiredError";
  }
}
