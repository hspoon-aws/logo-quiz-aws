import { Module } from '@nestjs/common';
import { LevelController } from './level.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [LevelController],
})
export class LevelModule {}
