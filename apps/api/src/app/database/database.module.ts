import { Global, Module } from '@nestjs/common';
import { DynamoDBService } from '../../shared/service/dynamodb.service';

@Global()
@Module({
  providers: [DynamoDBService],
  exports: [DynamoDBService],
})
export class DatabaseModule {}
