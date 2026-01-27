import { Schema } from 'mongoose';

export const GameRoomSettingsSchema = new Schema({
  timeLimit: { type: Number, default: 120 }, // seconds
  maxPlayers: { type: Number, default: 8 },
  minPlayers: { type: Number, default: 2 },
  level: { type: Schema.Types.ObjectId, ref: 'Level', default: null },
  logoCount: { type: Number, default: 10 },
  autoStart: { type: Boolean, default: false },
}, { _id: false });

export const GameRoomPlayerSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  displayName: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  isReady: { type: Boolean, default: false },
  socketId: { type: String, required: true },
}, { _id: false });

export const GameRoomSchema = new Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  host: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  hostSocketId: { type: String, required: true },
  hostDisplayName: { type: String, required: true },
  players: [GameRoomPlayerSchema],
  settings: { type: GameRoomSettingsSchema, default: () => ({}) },
  status: {
    type: String,
    enum: ['waiting', 'starting', 'in_progress', 'completed', 'cancelled'],
    default: 'waiting',
  },
  logos: [{ type: Schema.Types.ObjectId, ref: 'Logo' }],
  currentLogoIndex: { type: Number, default: 0 },
  gameStartedAt: { type: Date, default: null },
  gameEndedAt: { type: Date, default: null },
}, { timestamps: true });
