import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameGateway } from './game.gateway';
import { SharedModule } from '../../shared/shared.module';
import { GameRoomService } from '../../shared/service/game-room.service';
import { GameSessionService } from '../../shared/service/game-session.service';
import { GameTimerService } from '../../shared/service/game-timer.service';
import { gameRoomProvider } from '../../shared/providers/game-room.provider';
import { gameSessionProvider } from '../../shared/providers/game-session.provider';
import { WsJwtGuard } from '../../shared/guards/ws-jwt.guard';
import { config } from '../../config';

@Module({
  imports: [
    SharedModule,
    JwtModule.register({
      secret: config.session.secret,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [
    // Model providers first (they provide the database models)
    ...gameRoomProvider,
    ...gameSessionProvider,
    // Services that depend on models
    GameRoomService,
    GameSessionService,
    GameTimerService,
    // Guard for authentication
    WsJwtGuard,
    // Gateway that uses all the services
    GameGateway,
  ],
})
export class GameModule {}
