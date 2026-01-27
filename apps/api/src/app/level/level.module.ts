import { Module } from '@nestjs/common';
import { LevelController } from './level.controller';
import { LevelService } from '../../shared/service/level.service';
import { LogoService } from '../../shared/service/logo.service';
import { levelProvider } from '../../shared/providers/level.provider';
import { logoProvider } from '../../shared/providers/logo.provider';

@Module({
  providers: [
    ...levelProvider,
    ...logoProvider,
    LevelService,
    LogoService,
  ],
  controllers: [LevelController],
})
export class LevelModule {}
