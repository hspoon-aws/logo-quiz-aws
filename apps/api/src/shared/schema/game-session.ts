import { Schema } from 'mongoose';

export const GameAnswerSchema = new Schema({
  logo: { type: Schema.Types.ObjectId, ref: 'Logo', required: true },
  correct: { type: Boolean, required: true },
  timeTaken: { type: Number, required: true }, // milliseconds
  points: { type: Number, default: 0 },
  answeredAt: { type: Date, default: Date.now },
}, { _id: false });

export const GameSessionSchema = new Schema({
  gameRoom: { type: Schema.Types.ObjectId, ref: 'GameRoom', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  displayName: { type: String, required: true },
  socketId: { type: String, required: true },
  score: { type: Number, default: 0 },
  answers: [GameAnswerSchema],
  correctAnswers: { type: Number, default: 0 },
  finalRank: { type: Number, default: null },
}, { timestamps: true });
