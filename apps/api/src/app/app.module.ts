import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from '../shared/exception-filter/all.exceptions.filter';
import { LevelModule } from './level/level.module';
import { LogoModule } from './logo/logo.module';
import { UserModule } from './user/user.module';
import { GameModule } from './game/game.module';
import { LoggerInterceptor } from '../shared/interceptors/logger.interceptor';
import { NotifierService } from '../shared/service/notifier.service';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    LevelModule,
    LogoModule,
    UserModule,
    AuthModule,
    GameModule,
  ],
  providers: [
    NotifierService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    }, {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor,
    },
  ],
})
export class AppModule {}
