import { Module } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { DateProvider } from './date.provider.js';

@Module({
  providers: [SessionService, DateProvider],
  exports: [SessionService, DateProvider],
})
export class SessionModule {}
