import { Injectable } from '@nestjs/common';

@Injectable()
export class NotifierService {
  notify(args: any) {
    // Airbrake notifier disabled - just log to console in development
    console.error('[Notifier]', args);
  }
}
