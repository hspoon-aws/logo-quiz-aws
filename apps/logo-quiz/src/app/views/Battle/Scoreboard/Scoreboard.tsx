import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Link, Navigate } from 'react-router-dom';
import { AppState, GameRoomState, gameFlush, disconnectFromGame } from '@logo-quiz/store';
import './Scoreboard.scss';

interface ScoreboardProps {
  gameRoom: GameRoomState;
  gameFlush: typeof gameFlush;
  disconnectFromGame: typeof disconnectFromGame;
}

class Scoreboard extends React.Component<ScoreboardProps> {
  handlePlayAgain = () => {
    this.props.gameFlush();
  };

  handleExit = () => {
    this.props.disconnectFromGame();
  };

  getMedalEmoji(rank: number): string {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  }

  render() {
    const { gameRoom } = this.props;
    const { finalScoreboard, phase, displayName } = gameRoom;

    // Redirect if not in ended phase
    if (phase !== 'ended' || !finalScoreboard) {
      return <Navigate to="/battle" replace />;
    }

    const winner = finalScoreboard.rankings[0];

    return (
      <div className="scoreboard container">
        <div className="scoreboard__wrapper">
          <h2 className="scoreboard__title">Game Over!</h2>

          <div className="scoreboard__winner">
            <span className="scoreboard__winner-medal">🏆</span>
            <span className="scoreboard__winner-name">{winner.displayName}</span>
            <span className="scoreboard__winner-score">{winner.score} pts</span>
          </div>

          <div className="scoreboard__stats">
            <div className="scoreboard__stat">
              <span className="scoreboard__stat-label">Total Logos</span>
              <span className="scoreboard__stat-value">{finalScoreboard.totalLogos}</span>
            </div>
            <div className="scoreboard__stat">
              <span className="scoreboard__stat-label">Game Time</span>
              <span className="scoreboard__stat-value">{Math.floor(finalScoreboard.gameTime)}s</span>
            </div>
          </div>

          <div className="scoreboard__rankings">
            <h3 className="scoreboard__rankings-title">Final Rankings</h3>
            <div className="scoreboard__rankings-list">
              {finalScoreboard.rankings.map((player, index) => (
                <div
                  key={index}
                  className={`scoreboard__ranking ${player.displayName === displayName ? 'highlight' : ''}`}
                >
                  <span className="scoreboard__ranking-position">
                    {this.getMedalEmoji(player.rank) || `#${player.rank}`}
                  </span>
                  <span className="scoreboard__ranking-name">{player.displayName}</span>
                  <span className="scoreboard__ranking-correct">
                    {player.correctAnswers}/{finalScoreboard.totalLogos}
                  </span>
                  <span className="scoreboard__ranking-score">{player.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div className="scoreboard__actions">
            <Link
              to="/battle"
              onClick={this.handlePlayAgain}
              className="scoreboard__action main__button"
            >
              Play Again
            </Link>
            <Link
              to="/"
              onClick={this.handleExit}
              className="scoreboard__action scoreboard__action--secondary"
            >
              Back to Home
            </Link>
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
  gameFlush: () => dispatch(gameFlush()),
  disconnectFromGame: () => dispatch(disconnectFromGame()),
});

export default connect(mapStateToProps, mapDispatchToProps)(Scoreboard);
