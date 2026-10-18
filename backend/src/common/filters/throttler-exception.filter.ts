import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * TC-M1.7-10 — return a clear 429 body + Retry-After when global rate limit is hit.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const retryAfterSec = 10;

    response.setHeader('Retry-After', String(retryAfterSec));
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message:
        'Rate limit exceeded. Too many requests from this IP. Please wait and try again.',
      code: 'API_RATE_LIMITED',
      retryAfterSec,
    });
  }
}
