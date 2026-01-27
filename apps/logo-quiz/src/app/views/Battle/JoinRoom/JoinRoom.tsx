import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Link, Navigate } from 'react-router-dom';
import { AppState, GameRoomState, connectToGame, joinRoom } from '@logo-quiz/store';
import SVGBackArrow from '../../../icons/back-arrow';
import './JoinRoom.scss';

interface JoinRoomProps {
  gameRoom: GameRoomState;
  connectToGame: typeof connectToGame;
  joinRoom: typeof joinRoom;
}

interface JoinRoomFormState {
  displayName: string;
  roomCode: string;
}

class JoinRoom extends React.Component<JoinRoomProps, JoinRoomFormState> {
  constructor(props: JoinRoomProps) {
    super(props);
    this.state = {
      displayName: '',
      roomCode: '',
    };
  }

  componentDidMount() {
    if (!this.props.gameRoom.isConnected && !this.props.gameRoom.isConnecting) {
      this.props.connectToGame();
    }
  }

  handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!this.state.displayName.trim() || !this.state.roomCode.trim()) return;

    this.props.joinRoom(this.state.roomCode.toUpperCase().trim(), this.state.displayName.trim());
  };

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    this.setState({ [name]: value } as any);
  };

  render() {
    // Redirect to lobby if joined
    if (this.props.gameRoom.phase === 'lobby' && this.props.gameRoom.roomCode) {
      return <Navigate to={`/battle/lobby/${this.props.gameRoom.roomCode}`} replace />;
    }

    const { isConnecting, connectionError } = this.props.gameRoom;

    return (
      <div className="join-room container">
        <div className="header-wrapper">
          <Link to="/battle" className="header-back">
            <SVGBackArrow height="24px" />
          </Link>
          <h3 className="header-title">Join Battle Room</h3>
        </div>

        <div className="join-room__wrapper">
          <form onSubmit={this.handleSubmit} className="join-room__form">
            <div className="join-room__field">
              <label htmlFor="displayName">Your Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={this.state.displayName}
                onChange={this.handleChange}
                placeholder="Enter your display name"
                maxLength={20}
                required
              />
            </div>

            <div className="join-room__field">
              <label htmlFor="roomCode">Room Code</label>
              <input
                type="text"
                id="roomCode"
                name="roomCode"
                value={this.state.roomCode}
                onChange={this.handleChange}
                placeholder="Enter 6-character code"
                maxLength={6}
                className="join-room__code-input"
                required
              />
            </div>

            {connectionError && (
              <div className="join-room__error">{connectionError}</div>
            )}

            <button
              type="submit"
              className="join-room__submit main__button"
              disabled={isConnecting || !this.state.displayName.trim() || !this.state.roomCode.trim()}
            >
              {isConnecting ? 'Connecting...' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: AppState) => ({
  gameRoom: state.gameRoom,
});

const mapDispatchToProps = (dispatch: ThunkDispatch<{}, {}, any>) => ({
  connectToGame: () => dispatch(connectToGame()),
  joinRoom: (roomCode: string, displayName: string) => dispatch(joinRoom(roomCode, displayName)),
});

export default connect(mapStateToProps, mapDispatchToProps)(JoinRoom);
