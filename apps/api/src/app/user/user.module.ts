import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [UserController],
  exports: [SharedModule],
})
export class UserModule {}
