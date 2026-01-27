import { Module } from '@nestjs/common';
import { LevelService } from './service/level.service';
import { DatabaseModule } from '../app/database/database.module';
import { LogoService } from './service/logo.service';
import { UserService } from './service/user.service';
import { UserStateService } from './service/user-state.service';
import { UserCompletedLogoService } from './service/user-completed-logo.service';

const services = [
  LevelService,
  LogoService,
  UserService,
  UserStateService,
  UserCompletedLogoService,
];

@Module({
  imports: [DatabaseModule],
  providers: [...services],
  exports: [...services],
})
export class SharedModule {}
