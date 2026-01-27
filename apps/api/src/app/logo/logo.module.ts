import { Module } from '@nestjs/common';
import { LogoController } from './logo.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [LogoController],
})
export class LogoModule {}
