import {
  GameRoomState,
  GameRoomActionTypes,
  GameRoomQuizLetter,
  GAME_ROOM_CONNECT,
  GAME_ROOM_CONNECTED,
  GAME_ROOM_DISCONNECTED,
  GAME_ROOM_ERROR,
  GAME_ROOM_CREATED,
  GAME_ROOM_JOIN,
  GAME_ROOM_JOINED,
  GAME_ROOM_LEFT,
  GAME_ROOM_CANCELLED,
  GAME_ROOM_STATE_UPDATE,
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
  GAME_EMPTY_SPACE,
  GAME_SPECIAL_CHAR,
  GAME_ANSWER_REVEALED,
} from './types';

const initialState: GameRoomState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  roomCode: null,
  roomState: null,
  phase: 'disconnected',
  isHost: false,
  displayName: null,
  currentLogo: null,
  guess: [],
  options: [],
  timeRemaining: 0,
  totalTime: 0,
  leaderboard: [],
  isSubmitting: false,
  lastAnswerResult: null,
  myScore: 0,
  myCorrectAnswers: 0,
  revealedAnswer: null,
  finalScoreboard: null,
};

function parseLogoToGuessAndOptions(letters: string, obfuscatedName?: string): {
  guess: GameRoomQuizLetter[];
  options: GameRoomQuizLetter[];
} {
  // Create options from letters
  const options: GameRoomQuizLetter[] = letters.split('').map((char, id) => ({ char, id }));

  // Character mapping for obfuscatedName pattern
  const charMap: { [char: string]: GameRoomQuizLetter } = {
    '*': GAME_NO_LETTER,
    '_': GAME_EMPTY_SPACE, // Underscore represents a space in the answer
  };

  // Create guess array based on obfuscatedName pattern if available
  let guess: GameRoomQuizLetter[];
  if (obfuscatedName) {
    // Use obfuscatedName pattern (e.g., "****_***" for "NICE DCV")
    guess = obfuscatedName.split('').map(char => charMap[char] || { char, id: -3 });
  } else {
    // Fallback: create empty slots based on letters length
    const guessLength = Math.min(letters.length, 15);
    guess = [];
    for (let i = 0; i < guessLength; i++) {
      guess.push(GAME_NO_LETTER);
    }
  }

  return { guess, options };
}

export function gameRoomReducer(state = initialState, action: GameRoomActionTypes): GameRoomState {
  switch (action.type) {
    case GAME_ROOM_CONNECT:
      return {
        ...state,
        isConnecting: true,
        connectionError: null,
      };

    case GAME_ROOM_CONNECTED:
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        phase: 'connected',
      };

    case GAME_ROOM_DISCONNECTED:
      return {
        ...initialState,
      };

    case GAME_ROOM_ERROR:
      return {
        ...state,
        isConnecting: false,
        connectionError: action.error,
      };

    case GAME_ROOM_CREATED:
      return {
        ...state,
        roomCode: action.roomCode,
        roomState: action.state,
        phase: 'lobby',
        isHost: true,
        displayName: action.state.hostDisplayName,
      };

    case GAME_ROOM_JOIN:
      // Store displayName early when attempting to join (before socket response)
      return {
        ...state,
        displayName: action.displayName,
      };

    case GAME_ROOM_JOINED:
      return {
        ...state,
        roomCode: action.roomCode,
        roomState: action.state,
        phase: 'lobby',
        isHost: false,
        // Use displayName from action if available, otherwise keep existing state value
        displayName: action.displayName || state.displayName,
      };

    case GAME_ROOM_LEFT:
      return {
        ...state,
        roomCode: null,
        roomState: null,
        phase: 'connected',
        isHost: false,
        displayName: null,
      };

    case GAME_ROOM_CANCELLED:
      return {
        ...state,
        roomCode: null,
        roomState: null,
        phase: 'connected',
        isHost: false,
        connectionError: action.reason,
      };

    case GAME_ROOM_STATE_UPDATE:
      return {
        ...state,
        roomState: action.state,
        phase: action.state.status === 'in_progress' ? 'playing' :
               action.state.status === 'completed' ? 'ended' : state.phase,
      };

    case GAME_STARTED:
      return {
        ...state,
        phase: 'playing',
        timeRemaining: action.timeLimit,
        totalTime: action.timeLimit,
        myScore: 0,
        myCorrectAnswers: 0,
        leaderboard: [],
        finalScoreboard: null,
      };

    case GAME_LOGO_RECEIVED:
      const { guess, options } = parseLogoToGuessAndOptions(action.logo.letters, action.logo.obfuscatedName);
      return {
        ...state,
        currentLogo: action.logo,
        guess,
        options,
        lastAnswerResult: null,
        isSubmitting: false,
        revealedAnswer: null,
      };

    case GAME_ANSWER_SUBMIT:
      return {
        ...state,
        isSubmitting: true,
      };

    case GAME_ANSWER_RESULT: {
      // If wrong answer, reset the guess to empty slots
      let newGuess = state.guess;
      let newOptions = state.options;
      if (!action.result.correct && state.currentLogo) {
        const parsed = parseLogoToGuessAndOptions(state.currentLogo.letters, state.currentLogo.obfuscatedName);
        newGuess = parsed.guess;
        newOptions = parsed.options;
      }
      return {
        ...state,
        isSubmitting: false,
        lastAnswerResult: action.result,
        myScore: action.result.totalScore,
        myCorrectAnswers: action.result.correct ? state.myCorrectAnswers + 1 : state.myCorrectAnswers,
        guess: newGuess,
        options: newOptions,
      };
    }

    case GAME_SCORE_UPDATE:
      return {
        ...state,
        leaderboard: action.leaderboard,
      };

    case GAME_TIMER_UPDATE:
      return {
        ...state,
        timeRemaining: action.timeRemaining,
      };

    case GAME_END:
      return {
        ...state,
        phase: 'ended',
        finalScoreboard: action.scoreboard,
      };

    case GAME_ANSWER_REVEALED:
      return {
        ...state,
        revealedAnswer: {
          answer: action.answer,
          solvedBy: action.solvedBy,
        },
      };

    case GAME_GUESS_LETTER: {
      const newGuess = state.guess.slice();
      const availableIndex = newGuess.findIndex(el => el.id === GAME_NO_LETTER.id);
      if (availableIndex !== -1) {
        newGuess[availableIndex] = action.letter;
      }
      return {
        ...state,
        guess: newGuess,
        lastAnswerResult: null,
      };
    }

    case GAME_REMOVE_LETTER: {
      const newGuess = state.guess.slice();
      const index = newGuess.findIndex(el => el.id === action.letter.id);
      if (index !== -1) {
        newGuess[index] = GAME_NO_LETTER;
      }
      return {
        ...state,
        guess: newGuess,
        lastAnswerResult: null,
      };
    }

    case GAME_FLUSH:
      return {
        ...initialState,
        isConnected: state.isConnected,
        phase: state.isConnected ? 'connected' : 'disconnected',
      };

    default:
      return state;
  }
}
