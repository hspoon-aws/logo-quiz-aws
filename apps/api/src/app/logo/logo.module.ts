import { Module } from '@nestjs/common';
import { LogoController } from './logo.controller';
import { LogoService } from '../../shared/service/logo.service';
import { LevelService } from '../../shared/service/level.service';
import { logoProvider } from '../../shared/providers/logo.provider';
import { levelProvider } from '../../shared/providers/level.provider';

@Module({
  providers: [
    ...logoProvider,
    ...levelProvider,
    LogoService,
    LevelService,
  ],
  controllers: [LogoController],
})
export class LogoModule {}
