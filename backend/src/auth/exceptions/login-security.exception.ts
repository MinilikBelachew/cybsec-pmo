import { HttpException, HttpStatus } from '@nestjs/common';

export type LoginSecurityCode = 'AUTH_RATE_LIMITED' | 'AUTH_LOGIN_LOCKED';

export class LoginSecurityException extends HttpException {
  readonly retryAfterSec: number;
  readonly securityCode: LoginSecurityCode;

  constructor(
    message: string,
    securityCode: LoginSecurityCode,
    retryAfterSec: number,
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        code: securityCode,
        retryAfter: retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.securityCode = securityCode;
    this.retryAfterSec = retryAfterSec;
  }
}
