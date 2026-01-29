import { Dispatch } from 'redux';
import { socketService } from '../../shared/services/socket.service';
import {
  GameRoomActionTypes,
  GameRoomQuizLetter,
  GAME_ROOM_CONNECT,
  GAME_ROOM_CONNECTED,
  GAME_ROOM_DISCONNECT,
  GAME_ROOM_DISCONNECTED,
  GAME_ROOM_ERROR,
  GAME_ROOM_CREATE,
  GAME_ROOM_CREATED,
  GAME_ROOM_JOIN,
  GAME_ROOM_JOINED,
  GAME_ROOM_LEAVE,
  GAME_ROOM_LEFT,
  GAME_ROOM_CANCELLED,
  GAME_ROOM_STATE_UPDATE,
  GAME_ROOM_SET_READY,
  GAME_START,
  GAME_STARTED,
  GAME_LOGO_RECEIVED,
  GAME_ANSWER_SUBMIT,
  GAME_ANSWER_RESULT,
  GAME_SCORE_UPDATE,
  GAME_TIMER_UPDATE,
  GAME_END,
  GAME_GUESS_LETTER,
  GAME_REMOVE_LETTER,
  GAME_FLUSH,
  GAME_NO_LETTER,
  GAME_ANSWER_REVEALED,
} from './types';
import {
  RoomStateDto,
  GameLogoDto,
  FinalScoreboardDto,
  PlayerScore,
  AnswerResultDto,
  GameRoomSettings,
} from '@logo-quiz/models';
import { AppState } from '../index';

// Client-side timer since Lambda can't send periodic updates
let clientTimerInterval: ReturnType<typeof setInterval> | null = null;

function clearClientTimer() {
  if (clientTimerInterval) {
    clearInterval(clientTimerInterval);
    clientTimerInterval = null;
  }
}

function startClientTimer(dispatch: any, getState: () => AppState) {
  clearClientTimer();

  clientTimerInterval = setInterval(() => {
    const state = getState();
    const newTime = state.gameRoom.timeRemaining - 1;

    if (newTime <= 0) {
      clearClientTimer();
      dispatch(gameTimerUpdate(0));

      // Only host sends timeout to prevent duplicate game ends
      if (state.gameRoom.isHost) {
        socketService.gameTimeout().catch(err => {
          console.error('Failed to send game timeout:', err);
        });
      }
    } else {
      dispatch(gameTimerUpdate(newTime));
    }
  }, 1000);
}

// Action creators
export function gameRoomConnect(): GameRoomActionTypes {
  return { type: GAME_ROOM_CONNECT };
}

export function gameRoomConnected(): GameRoomActionTypes {
  return { type: GAME_ROOM_CONNECTED };
}

export function gameRoomDisconnect(): GameRoomActionTypes {
  return { type: GAME_ROOM_DISCONNECT };
}

export function gameRoomDisconnected(): GameRoomActionTypes {
  return { type: GAME_ROOM_DISCONNECTED };
}

export function gameRoomError(error: string): GameRoomActionTypes {
  return { type: GAME_ROOM_ERROR, error };
}

export function gameRoomCreated(roomCode: string, state: RoomStateDto): GameRoomActionTypes {
  return { type: GAME_ROOM_CREATED, roomCode, state };
}

export function gameRoomJoined(roomCode: string, state: RoomStateDto, displayName: string): GameRoomActionTypes {
  return { type: GAME_ROOM_JOINED, roomCode, state, displayName };
}

export function gameRoomLeft(): GameRoomActionTypes {
  return { type: GAME_ROOM_LEFT };
}

export function gameRoomCancelled(reason: string): GameRoomActionTypes {
  return { type: GAME_ROOM_CANCELLED, reason };
}

export function gameRoomStateUpdate(state: RoomStateDto): GameRoomActionTypes {
  return { type: GAME_ROOM_STATE_UPDATE, state };
}

export function gameStarted(totalLogos: number, timeLimit: number): GameRoomActionTypes {
  return { type: GAME_STARTED, totalLogos, timeLimit };
}

export function gameLogoReceived(logo: GameLogoDto): GameRoomActionTypes {
  return { type: GAME_LOGO_RECEIVED, logo };
}

export function gameAnswerResult(result: AnswerResultDto): GameRoomActionTypes {
  return { type: GAME_ANSWER_RESULT, result };
}

export function gameScoreUpdate(leaderboard: PlayerScore[]): GameRoomActionTypes {
  return { type: GAME_SCORE_UPDATE, leaderboard };
}

export function gameTimerUpdate(timeRemaining: number): GameRoomActionTypes {
  return { type: GAME_TIMER_UPDATE, timeRemaining };
}

export function gameEnd(scoreboard: FinalScoreboardDto): GameRoomActionTypes {
  return { type: GAME_END, scoreboard };
}

export function gameGuessLetter(letter: GameRoomQuizLetter): GameRoomActionTypes {
  return { type: GAME_GUESS_LETTER, letter };
}

export function gameRemoveLetter(letter: GameRoomQuizLetter): GameRoomActionTypes {
  return { type: GAME_REMOVE_LETTER, letter };
}

export function gameFlush(): GameRoomActionTypes {
  return { type: GAME_FLUSH };
}

export function gameAnswerRevealed(answer: string, solvedBy: string): GameRoomActionTypes {
  return { type: GAME_ANSWER_REVEALED, answer, solvedBy };
}

// Thunk actions
export function connectToGame() {
  return async function (dispatch: Dispatch, getState: () => AppState) {
    dispatch(gameRoomConnect());
    try {
      await socketService.connect();
      dispatch(gameRoomConnected());

      // Set up event listeners
      socketService.onRoomCreated(({ roomCode, state }) => {
        dispatch(gameRoomCreated(roomCode, state));
      });

      socketService.onRoomJoined(({ roomCode, state }) => {
        // displayName not available from socket event - reducer will use stored value from GAME_ROOM_JOIN
        dispatch(gameRoomJoined(roomCode, state, ''));
      });

      socketService.onRoomError(({ message }) => {
        dispatch(gameRoomError(message));
      });

      socketService.onRoomState((state) => {
        dispatch(gameRoomStateUpdate(state));
      });

      socketService.onRoomCancelled(({ reason }) => {
        dispatch(gameRoomCancelled(reason));
      });

      socketService.onGameStarted(({ totalLogos, timeLimit }) => {
        dispatch(gameStarted(totalLogos, timeLimit));
        // Start client-side timer countdown
        startClientTimer(dispatch, getState);
      });

      socketService.onGameLogo((logo) => {
        dispatch(gameLogoReceived(logo));
      });

      socketService.onAnswerResult((result) => {
        dispatch(gameAnswerResult(result));
      });

      socketService.onScoreUpdate(({ leaderboard }) => {
        dispatch(gameScoreUpdate(leaderboard));
      });

      socketService.onGameTimer(({ timeRemaining }) => {
        dispatch(gameTimerUpdate(timeRemaining));
      });

      socketService.onGameEnd((scoreboard) => {
        clearClientTimer();
        dispatch(gameEnd(scoreboard));
      });

      socketService.onAnswerRevealed(({ answer, solvedBy }) => {
        dispatch(gameAnswerRevealed(answer, solvedBy));
      });
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to connect'));
    }
  };
}

export function disconnectFromGame() {
  return function (dispatch: Dispatch) {
    clearClientTimer();
    socketService.removeAllListeners();
    socketService.disconnect();
    dispatch(gameRoomDisconnected());
  };
}

export function createRoom(displayName: string, settings?: Partial<GameRoomSettings>) {
  return async function (dispatch: Dispatch) {
    dispatch({ type: GAME_ROOM_CREATE, displayName });
    try {
      const result = await socketService.createRoom({ displayName, settings });
      if (result) {
        dispatch(gameRoomCreated(result.roomCode, result.state));
      }
      // Note: room:created event listener also handles this as a fallback
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to create room'));
    }
  };
}

export function joinRoom(roomCode: string, displayName: string) {
  return async function (dispatch: Dispatch) {
    dispatch({ type: GAME_ROOM_JOIN, roomCode, displayName });
    try {
      const result = await socketService.joinRoom({ roomCode, displayName });
      // In production (native WebSocket), result is undefined - response comes via event listener
      if (!result) {
        // Response will come via onRoomJoined or onRoomError event listeners
        return;
      }
      if ('message' in result) {
        dispatch(gameRoomError(result.message));
      } else {
        dispatch(gameRoomJoined(result.roomCode, result.state, displayName));
      }
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to join room'));
    }
  };
}

export function leaveRoom() {
  return async function (dispatch: Dispatch) {
    dispatch({ type: GAME_ROOM_LEAVE });
    try {
      await socketService.leaveRoom();
      dispatch(gameRoomLeft());
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to leave room'));
    }
  };
}

export function setReady(isReady: boolean) {
  return async function (dispatch: Dispatch) {
    dispatch({ type: GAME_ROOM_SET_READY, isReady });
    try {
      await socketService.setReady(isReady);
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to update ready status'));
    }
  };
}

export function startGame() {
  return async function (dispatch: Dispatch) {
    dispatch({ type: GAME_START });
    try {
      await socketService.startGame();
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to start game'));
    }
  };
}

export function submitAnswer() {
  return async function (dispatch: Dispatch, getState: () => AppState) {
    const { gameRoom } = getState();
    if (!gameRoom.currentLogo) return;

    const guess = gameRoom.guess
      .filter(l => l.id >= 0 || l.id === -2 || l.id === -3) // Include letters, spaces (-2), and special chars (-3)
      .map(l => l.char)
      .join('')
      .replace(/_/g, ' '); // Convert underscore to space

    dispatch({ type: GAME_ANSWER_SUBMIT });
    try {
      await socketService.submitAnswer({
        logoId: gameRoom.currentLogo.logoId,
        guess,
      });
    } catch (error) {
      dispatch(gameRoomError(error.message || 'Failed to submit answer'));
    }
  };
}

export function guessLetterInGame(letter: GameRoomQuizLetter) {
  return function (dispatch: Dispatch, getState: () => AppState) {
    const { gameRoom } = getState();
    const guess = gameRoom.guess;

    // Check if there's an empty spot
    const hasEmptySpot = guess.some(l => l.id === GAME_NO_LETTER.id);
    if (!hasEmptySpot) return;

    dispatch(gameGuessLetter(letter));

    // Check if guess is complete and auto-submit
    const newState = getState();
    const isComplete = !newState.gameRoom.guess.some(l => l.id === GAME_NO_LETTER.id);
    if (isComplete) {
      dispatch(submitAnswer() as any);
    }
  };
}

export function removeLetterInGame(letter: GameRoomQuizLetter) {
  return function (dispatch: Dispatch) {
    dispatch(gameRemoveLetter(letter));
  };
}
