import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from '../../shared/service/user.service';
import { userProvider } from '../../shared/providers/user.provider';

@Module({
  providers: [
    ...userProvider,
    UserService,
  ],
  controllers: [UserController],
  exports: [UserService, ...userProvider],
})
export class UserModule {}
  