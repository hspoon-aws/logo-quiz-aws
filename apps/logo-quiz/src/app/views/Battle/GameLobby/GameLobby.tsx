import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  AppState,
  GameRoomState,
  setReady,
  startGame,
  leaveRoom,
  connectToGame,
} from '@logo-quiz/store';
import SVGBackArrow from '../../../icons/back-arrow';
import './GameLobby.scss';

interface GameLobbyProps {
  roomCode: string;
  gameRoom: GameRoomState;
  setReady: typeof setReady;
  startGame: typeof startGame;
  leaveRoom: typeof leaveRoom;
  connectToGame: typeof connectToGame;
}

class GameLobby extends React.Component<GameLobbyProps> {
  componentDidMount() {
    if (!this.props.gameRoom.isConnected && !this.props.gameRoom.isConnecting) {
      this.props.connectToGame();
    }
  }

  handleReadyToggle = () => {
    // Toggle ready status - find current player's ready status
    const myReadyStatus = this.getMyReadyStatus();
    this.props.setReady(!myReadyStatus);
  };

  handleStartGame = () => {
    this.props.startGame();
  };

  handleLeaveRoom = () => {
    this.props.leaveRoom();
  };

  getMyReadyStatus(): boolean {
    const { roomState, isHost, displayName } = this.props.gameRoom;
    if (!roomState) return false;
    if (isHost) return true;

    // Find our player in the list by display name
    const myPlayer = roomState.players.find(p => p.displayName === displayName);
    return myPlayer?.isReady || false;
  }

  canStartGame(): boolean {
    const { roomState, isHost } = this.props.gameRoom;
    if (!roomState || !isHost) return false;

    const totalPlayers = roomState.players.length;
    const readyPlayers = roomState.players.filter(p => p.isReady || p.isHost).length;
    const minPlayers = roomState.settings.minPlayers || 2;

    return totalPlayers >= minPlayers && readyPlayers === totalPlayers;
  }

  render() {
    const { gameRoom, roomCode } = this.props;
    const { roomState, isHost, phase, connectionError } = gameRoom;

    // Redirect to game if started
    if (phase === 'playing') {
      return <Navigate to={`/battle/game/${roomCode}`} replace />;
    }

    // Redirect back if no room
    if (phase === 'connected' || phase === 'disconnected') {
      return <Navigate to="/battle" replace />;
    }

    if (!roomState) {
      return (
        <div className="game-lobby container">
          <div className="game-lobby__loading">Loading...</div>
        </div>
      );
    }

    return (
      <div className="game-lobby container">
        <div className="header-wrapper">
          <button onClick={this.handleLeaveRoom} className="header-back">
            <SVGBackArrow height="24px" />
          </button>
          <h3 className="header-title">Battle Lobby</h3>
        </div>

        <div className="game-lobby__wrapper">
          <div className="game-lobby__room-code">
            <span className="game-lobby__room-code-label">Room Code</span>
            <span className="game-lobby__room-code-value">{roomState.roomCode}</span>
          </div>

          <div className="game-lobby__settings">
            <div className="game-lobby__setting">
              <span className="game-lobby__setting-label">Time Limit</span>
              <span className="game-lobby__setting-value">{roomState.settings.timeLimit}s</span>
            </div>
            <div className="game-lobby__setting">
              <span className="game-lobby__setting-label">Logos</span>
              <span className="game-lobby__setting-value">{roomState.settings.logoCount}</span>
            </div>
          </div>

          <div className="game-lobby__players">
            <h4 className="game-lobby__players-title">Players ({roomState.players.length})</h4>
            <ul className="game-lobby__players-list">
              {roomState.players.map((player, index) => (
                <li key={index} className="game-lobby__player">
                  <span className="game-lobby__player-name">
                    {player.displayName}
                    {player.isHost && <span className="game-lobby__host-badge">Host</span>}
                  </span>
                  <span className={`game-lobby__player-status ${player.isReady || player.isHost ? 'ready' : 'waiting'}`}>
                    {player.isHost ? 'Ready' : player.isReady ? 'Ready' : 'Waiting'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {connectionError && (
            <div className="game-lobby__error">{connectionError}</div>
          )}

          <div className="game-lobby__actions">
            {isHost ? (
              <button
                onClick={this.handleStartGame}
                className="game-lobby__start main__button"
                disabled={!this.canStartGame()}
              >
                Start Game
              </button>
            ) : (
              <button
                onClick={this.handleReadyToggle}
                className={`game-lobby__ready main__button ${this.getMyReadyStatus() ? 'ready' : ''}`}
              >
                {this.getMyReadyStatus() ? 'Not Ready' : 'Ready'}
              </button>
            )}
          </div>

          <p className="game-lobby__hint">
            {isHost
              ? 'Waiting for all players to be ready...'
              : 'Click Ready when you\'re set to play!'}
          </p>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  gameRoom: state.gameRoom,
});

const mapDispatchToProps = (dispatch: ThunkDispatch<{}, {}, any>) => ({
  setReady: (isReady: boolean) => dispatch(setReady(isReady)),
  startGame: () => dispatch(startGame()),
  leaveRoom: () => dispatch(leaveRoom()),
  connectToGame: () => dispatch(connectToGame()),
});

const ConnectedGameLobby = connect(mapStateToProps, mapDispatchToProps)(GameLobby);

// Wrapper component to inject route params
function GameLobbyWrapper() {
  const { roomCode } = useParams<{ roomCode: string }>();
  return <ConnectedGameLobby roomCode={roomCode || ''} />;
}

export default GameLobbyWrapper;
