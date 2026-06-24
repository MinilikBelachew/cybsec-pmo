import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { LoginSecurityException } from '../exceptions/login-security.exception';

@Catch(LoginSecurityException)
export class LoginSecurityExceptionFilter implements ExceptionFilter {
  catch(exception: LoginSecurityException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.setHeader('Retry-After', String(exception.retryAfterSec));
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}

/** Sets Retry-After on generic 429 responses from Nest throttler-style errors. */
@Catch(HttpException)
export class HttpRetryAfterFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (
      status === 429 &&
      typeof body === 'object' &&
      body !== null &&
      'retryAfter' in body &&
      typeof (body as { retryAfter: unknown }).retryAfter === 'number'
    ) {
      response.setHeader(
        'Retry-After',
        String((body as { retryAfter: number }).retryAfter),
      );
    }

    response.status(status).json(body);
  }
}
