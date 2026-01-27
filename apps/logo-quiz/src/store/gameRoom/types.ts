import {
  RoomStateDto,
  GameLogoDto,
  FinalScoreboardDto,
  PlayerScore,
  AnswerResultDto,
} from '@logo-quiz/models';

/** Actions */
export const GAME_ROOM_CONNECT = 'GAME_ROOM_CONNECT';
export const GAME_ROOM_CONNECTED = 'GAME_ROOM_CONNECTED';
export const GAME_ROOM_DISCONNECT = 'GAME_ROOM_DISCONNECT';
export const GAME_ROOM_DISCONNECTED = 'GAME_ROOM_DISCONNECTED';
export const GAME_ROOM_ERROR = 'GAME_ROOM_ERROR';

export const GAME_ROOM_CREATE = 'GAME_ROOM_CREATE';
export const GAME_ROOM_CREATED = 'GAME_ROOM_CREATED';
export const GAME_ROOM_JOIN = 'GAME_ROOM_JOIN';
export const GAME_ROOM_JOINED = 'GAME_ROOM_JOINED';
export const GAME_ROOM_LEAVE = 'GAME_ROOM_LEAVE';
export const GAME_ROOM_LEFT = 'GAME_ROOM_LEFT';
export const GAME_ROOM_CANCELLED = 'GAME_ROOM_CANCELLED';

export const GAME_ROOM_STATE_UPDATE = 'GAME_ROOM_STATE_UPDATE';
export const GAME_ROOM_SET_READY = 'GAME_ROOM_SET_READY';

export const GAME_START = 'GAME_START';
export const GAME_STARTED = 'GAME_STARTED';
export const GAME_LOGO_RECEIVED = 'GAME_LOGO_RECEIVED';
export const GAME_ANSWER_SUBMIT = 'GAME_ANSWER_SUBMIT';
export const GAME_ANSWER_RESULT = 'GAME_ANSWER_RESULT';
export const GAME_SCORE_UPDATE = 'GAME_SCORE_UPDATE';
export const GAME_TIMER_UPDATE = 'GAME_TIMER_UPDATE';
export const GAME_END = 'GAME_END';

export const GAME_GUESS_LETTER = 'GAME_GUESS_LETTER';
export const GAME_REMOVE_LETTER = 'GAME_REMOVE_LETTER';
export const GAME_FLUSH = 'GAME_FLUSH';
export const GAME_ANSWER_REVEALED = 'GAME_ANSWER_REVEALED';

/** Types */
export interface GameRoomQuizLetter {
  char: string;
  id: number;
}

export const GAME_NO_LETTER: GameRoomQuizLetter = { char: '*', id: -1 };
export const GAME_EMPTY_SPACE: GameRoomQuizLetter = { char: '_', id: -2 };
export const GAME_SPECIAL_CHAR: GameRoomQuizLetter = { char: '', id: -3 };

export type GameRoomPhase = 'disconnected' | 'connected' | 'lobby' | 'playing' | 'ended';

export interface GameRoomState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Room state
  roomCode: string | null;
  roomState: RoomStateDto | null;
  phase: GameRoomPhase;
  isHost: boolean;
  displayName: string | null;

  // Game state
  currentLogo: GameLogoDto | null;
  guess: GameRoomQuizLetter[];
  options: GameRoomQuizLetter[];
  timeRemaining: number;
  totalTime: number;
  leaderboard: PlayerScore[];

  // Answer state
  isSubmitting: boolean;
  lastAnswerResult: AnswerResultDto | null;
  myScore: number;
  myCorrectAnswers: number;

  // Revealed answer (when someone solves it)
  revealedAnswer: { answer: string; solvedBy: string } | null;

  // Final state
  finalScoreboard: FinalScoreboardDto | null;
}

/** Action Types */
interface GameRoomConnectAction {
  type: typeof GAME_ROOM_CONNECT;
}

interface GameRoomConnectedAction {
  type: typeof GAME_ROOM_CONNECTED;
}

interface GameRoomDisconnectAction {
  type: typeof GAME_ROOM_DISCONNECT;
}

interface GameRoomDisconnectedAction {
  type: typeof GAME_ROOM_DISCONNECTED;
}

interface GameRoomErrorAction {
  type: typeof GAME_ROOM_ERROR;
  error: string;
}

interface GameRoomCreateAction {
  type: typeof GAME_ROOM_CREATE;
  displayName: string;
}

interface GameRoomCreatedAction {
  type: typeof GAME_ROOM_CREATED;
  roomCode: string;
  state: RoomStateDto;
}

interface GameRoomJoinAction {
  type: typeof GAME_ROOM_JOIN;
  roomCode: string;
  displayName: string;
}

interface GameRoomJoinedAction {
  type: typeof GAME_ROOM_JOINED;
  roomCode: string;
  state: RoomStateDto;
  displayName: string;
}

interface GameRoomLeaveAction {
  type: typeof GAME_ROOM_LEAVE;
}

interface GameRoomLeftAction {
  type: typeof GAME_ROOM_LEFT;
}

interface GameRoomCancelledAction {
  type: typeof GAME_ROOM_CANCELLED;
  reason: string;
}

interface GameRoomStateUpdateAction {
  type: typeof GAME_ROOM_STATE_UPDATE;
  state: RoomStateDto;
}

interface GameRoomSetReadyAction {
  type: typeof GAME_ROOM_SET_READY;
  isReady: boolean;
}

interface GameStartAction {
  type: typeof GAME_START;
}

interface GameStartedAction {
  type: typeof GAME_STARTED;
  totalLogos: number;
  timeLimit: number;
}

interface GameLogoReceivedAction {
  type: typeof GAME_LOGO_RECEIVED;
  logo: GameLogoDto;
}

interface GameAnswerSubmitAction {
  type: typeof GAME_ANSWER_SUBMIT;
}

interface GameAnswerResultAction {
  type: typeof GAME_ANSWER_RESULT;
  result: AnswerResultDto;
}

interface GameScoreUpdateAction {
  type: typeof GAME_SCORE_UPDATE;
  leaderboard: PlayerScore[];
}

interface GameTimerUpdateAction {
  type: typeof GAME_TIMER_UPDATE;
  timeRemaining: number;
}

interface GameEndAction {
  type: typeof GAME_END;
  scoreboard: FinalScoreboardDto;
}

interface GameGuessLetterAction {
  type: typeof GAME_GUESS_LETTER;
  letter: GameRoomQuizLetter;
}

interface GameRemoveLetterAction {
  type: typeof GAME_REMOVE_LETTER;
  letter: GameRoomQuizLetter;
}

interface GameFlushAction {
  type: typeof GAME_FLUSH;
}

interface GameAnswerRevealedAction {
  type: typeof GAME_ANSWER_REVEALED;
  answer: string;
  solvedBy: string;
}

export type GameRoomActionTypes =
  | GameRoomConnectAction
  | GameRoomConnectedAction
  | GameRoomDisconnectAction
  | GameRoomDisconnectedAction
  | GameRoomErrorAction
  | GameRoomCreateAction
  | GameRoomCreatedAction
  | GameRoomJoinAction
  | GameRoomJoinedAction
  | GameRoomLeaveAction
  | GameRoomLeftAction
  | GameRoomCancelledAction
  | GameRoomStateUpdateAction
  | GameRoomSetReadyAction
  | GameStartAction
  | GameStartedAction
  | GameLogoReceivedAction
  | GameAnswerSubmitAction
  | GameAnswerResultAction
  | GameScoreUpdateAction
  | GameTimerUpdateAction
  | GameEndAction
  | GameGuessLetterAction
  | GameRemoveLetterAction
  | GameFlushAction
  | GameAnswerRevealedAction;
