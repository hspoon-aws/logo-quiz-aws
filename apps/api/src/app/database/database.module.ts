import { databaseProviders } from './database.providers';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule {}
