import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Router');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const [req, res]: [Request, Response] = context.getArgs();

    const now = Date.now();
    return next
    .handle()
    .pipe(
      tap((value) => {
        const message = `[Request] [${req.method}] [${req.originalUrl}] - [${res.statusCode}] - Time [${Date.now() - now}ms]`;
        this.logger.log(message);
      }),
    );
  }
}
