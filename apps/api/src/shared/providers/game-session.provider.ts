import { Connection } from 'mongoose';
import { GameSessionSchema } from '../schema/game-session';

export const gameSessionProvider = [
  {
    provide: 'GAME_SESSION_MODEL',
    useFactory: (connection: Connection) => connection.model('GameSession', GameSessionSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
