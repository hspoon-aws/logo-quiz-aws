import { Connection } from 'mongoose';
import { GameRoomSchema } from '../schema/game-room';

export const gameRoomProvider = [
  {
    provide: 'GAME_ROOM_MODEL',
    useFactory: (connection: Connection) => connection.model('GameRoom', GameRoomSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
