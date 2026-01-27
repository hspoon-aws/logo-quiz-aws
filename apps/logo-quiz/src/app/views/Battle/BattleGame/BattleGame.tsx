import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Navigate, useParams } from 'react-router-dom';
import {
  AppState,
  GameRoomState,
  GameRoomQuizLetter,
  GAME_NO_LETTER,
  GAME_EMPTY_SPACE,
  GAME_SPECIAL_CHAR,
  guessLetterInGame,
  removeLetterInGame,
  connectToGame,
} from '@logo-quiz/store';
import SVGDeleteLetter from '../../../icons/delete-letter';
import './BattleGame.scss';

interface BattleGameProps {
  roomCode: string;
  gameRoom: GameRoomState;
  guessLetterInGame: typeof guessLetterInGame;
  removeLetterInGame: typeof removeLetterInGame;
  connectToGame: typeof connectToGame;
}

interface BattleGameState {
  scoreAnimation: { points: number; visible: boolean } | null;
}

class BattleGame extends React.Component<BattleGameProps, BattleGameState> {
  private animationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: BattleGameProps) {
    super(props);
    this.state = {
      scoreAnimation: null,
    };
  }

  componentDidMount() {
    if (!this.props.gameRoom.isConnected && !this.props.gameRoom.isConnecting) {
      this.props.connectToGame();
    }
    window.addEventListener('keyup', this.keyHandler);
  }

  componentDidUpdate(prevProps: BattleGameProps) {
    const { lastAnswerResult } = this.props.gameRoom;
    const prevResult = prevProps.gameRoom.lastAnswerResult;

    // Trigger animation when we get a new answer result
    if (lastAnswerResult && lastAnswerResult !== prevResult) {
      this.showScoreAnimation(lastAnswerResult.points);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keyup', this.keyHandler);
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  showScoreAnimation(points: number) {
    // Clear any existing animation
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    // Show animation
    this.setState({ scoreAnimation: { points, visible: true } });

    // Hide after animation completes
    this.animationTimeout = setTimeout(() => {
      this.setState({ scoreAnimation: null });
    }, 1500);
  }

  keyHandler = (e: KeyboardEvent) => {
    const { gameRoom } = this.props;
    if (gameRoom.phase !== 'playing') return;

    const letter = e.key.toUpperCase();
    if (letter === 'BACKSPACE') {
      this.removeLastLetter();
      return;
    }

    const finalOption = gameRoom.options.find(({ char, id }) => {
      const matches = char.toUpperCase() === letter;
      const inGuess = gameRoom.guess.some(guessChar => guessChar.id === id);
      return matches && !inGuess;
    });

    if (finalOption) {
      this.props.guessLetterInGame(finalOption);
    }
  };

  removeLastLetter = () => {
    const { guess } = this.props.gameRoom;
    let last: GameRoomQuizLetter | null = null;
    for (let i = guess.length - 1; i >= 0 && !last; i--) {
      if (guess[i].id >= 0) {
        last = guess[i];
      }
    }
    if (last) {
      this.props.removeLetterInGame(last);
    }
  };

  isLetterDisabled(id: number): boolean {
    return this.props.gameRoom.guess.some(g => g.id === id);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  render() {
    const { gameRoom, roomCode } = this.props;
    const {
      phase,
      currentLogo,
      guess,
      options,
      timeRemaining,
      leaderboard,
      myScore,
      lastAnswerResult,
      isSubmitting,
      revealedAnswer,
    } = gameRoom;

    // Redirect to scoreboard when game ends
    if (phase === 'ended') {
      return <Navigate to={`/battle/scoreboard/${roomCode}`} replace />;
    }

    // Redirect if not in game
    if (phase !== 'playing') {
      return <Navigate to="/battle" replace />;
    }

    const isWrong = lastAnswerResult && !lastAnswerResult.correct;
    const isCorrect = lastAnswerResult && lastAnswerResult.correct;

    return (
      <div className="battle-game container">
        <div className="battle-game__header">
          <div className="battle-game__timer">
            <span className={`battle-game__timer-value ${timeRemaining <= 10 ? 'urgent' : ''}`}>
              {this.formatTime(timeRemaining)}
            </span>
          </div>
          <div className="battle-game__score">
            <span className="battle-game__score-value">{myScore} pts</span>
          </div>
        </div>

        {this.state.scoreAnimation && (
          <div
            className={`battle-game__score-animation ${
              this.state.scoreAnimation.points >= 0 ? 'positive' : 'negative'
            }`}
          >
            {this.state.scoreAnimation.points >= 0 ? '+' : ''}
            {this.state.scoreAnimation.points}
          </div>
        )}

        {revealedAnswer && (
          <div className="battle-game__revealed-answer">
            <div className="battle-game__revealed-answer-content">
              <div className="battle-game__revealed-answer-label">Answer</div>
              <div className="battle-game__revealed-answer-text">{revealedAnswer.answer}</div>
              <div className="battle-game__revealed-answer-solver">
                Solved by <strong>{revealedAnswer.solvedBy}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="battle-game__wrapper">
          {currentLogo && (
            <>
              <div className="battle-game__progress">
                Logo {currentLogo.logoIndex + 1} of {currentLogo.totalLogos}
              </div>

              <div className="battle-game__image-wrapper vh-center">
                <img
                  className="battle-game__image"
                  src={currentLogo.obfuscatedImageUrl}
                  alt="Guess the logo"
                />
              </div>

              <div className={`battle-game__guess h-center ${isSubmitting ? 'submitting' : ''}`}>
                {guess.map((letter, idx) => {
                  const isNoLetter = letter.id === GAME_NO_LETTER.id;
                  const isEmptySpace = letter.id === GAME_EMPTY_SPACE.id;
                  const isSpecialChar = letter.id === GAME_SPECIAL_CHAR.id;
                  const btnClass = [
                    'battle-game__guess-btn',
                    isWrong ? 'battle-game__guess-btn--wrong' : '',
                    isCorrect ? 'battle-game__guess-btn--correct' : '',
                  ].filter(Boolean).join(' ');

                  // Render space as a non-clickable span
                  if (isEmptySpace) {
                    return (
                      <span key={idx} className={`${btnClass} battle-game__guess-btn--space`}>
                        &nbsp;
                      </span>
                    );
                  }

                  // Render special chars (like hyphens) as non-clickable spans
                  if (isSpecialChar) {
                    return (
                      <span key={idx} className={`${btnClass} battle-game__guess-btn--special`}>
                        {letter.char}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={idx}
                      className={btnClass}
                      onClick={() => !isNoLetter && this.props.removeLetterInGame(letter)}
                      disabled={isNoLetter}
                    >
                      <span className="battle-game__btn-text">
                        {isNoLetter ? '' : letter.char}
                      </span>
                    </button>
                  );
                })}
              </div>

              {lastAnswerResult && !lastAnswerResult.correct && lastAnswerResult.correctAnswer && (
                <div className="battle-game__answer-hint">
                  Answer: {lastAnswerResult.correctAnswer}
                </div>
              )}

              <div className="battle-game__letters">
                {options.map(({ char, id }, i) => (
                  <div className="battle-game__btn-wrapper h-center" key={i}>
                    <button
                      className="battle-game__btn"
                      disabled={this.isLetterDisabled(id)}
                      onClick={() => this.props.guessLetterInGame({ char, id })}
                    >
                      <span className="battle-game__btn-text">{char}</span>
                    </button>
                  </div>
                ))}
                <div className="battle-game__btn-wrapper h-center">
                  <button
                    className="battle-game__btn battle-game__btn--delete"
                    onClick={this.removeLastLetter}
                  >
                    <span className="battle-game__btn-text">
                      <SVGDeleteLetter />
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="battle-game__leaderboard">
          <h4 className="battle-game__leaderboard-title">Live Scores</h4>
          <div className="battle-game__leaderboard-list">
            {leaderboard.slice(0, 5).map((player, index) => (
              <div key={index} className="battle-game__leaderboard-item">
                <span className="battle-game__leaderboard-rank">{index + 1}</span>
                <span className="battle-game__leaderboard-name">{player.displayName}</span>
                <span className="battle-game__leaderboard-score">{player.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  gameRoom: state.gameRoom,
});

const mapDispatchToProps = (dispatch: ThunkDispatch<{}, {}, any>) => ({
  guessLetterInGame: (letter: GameRoomQuizLetter) => dispatch(guessLetterInGame(letter)),
  removeLetterInGame: (letter: GameRoomQuizLetter) => dispatch(removeLetterInGame(letter)),
  connectToGame: () => dispatch(connectToGame()),
});

const ConnectedBattleGame = connect(mapStateToProps, mapDispatchToProps)(BattleGame);

// Wrapper component to inject route params
function BattleGameWrapper() {
  const { roomCode } = useParams<{ roomCode: string }>();
  return <ConnectedBattleGame roomCode={roomCode || ''} />;
}

export default BattleGameWrapper;
