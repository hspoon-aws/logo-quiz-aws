import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Link, Navigate } from 'react-router-dom';
import { AppState, GameRoomState, connectToGame, createRoom } from '@logo-quiz/store';
import SVGBackArrow from '../../../icons/back-arrow';
import './CreateRoom.scss';

interface CreateRoomProps {
  gameRoom: GameRoomState;
  connectToGame: typeof connectToGame;
  createRoom: typeof createRoom;
}

interface CreateRoomFormState {
  displayName: string;
  timeLimit: number;
  logoCount: number;
}

class CreateRoom extends React.Component<CreateRoomProps, CreateRoomFormState> {
  constructor(props: CreateRoomProps) {
    super(props);
    this.state = {
      displayName: '',
      timeLimit: 120,
      logoCount: 10,
    };
  }

  componentDidMount() {
    if (!this.props.gameRoom.isConnected && !this.props.gameRoom.isConnecting) {
      this.props.connectToGame();
    }
  }

  handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!this.state.displayName.trim()) return;

    this.props.createRoom(this.state.displayName.trim(), {
      timeLimit: this.state.timeLimit,
      logoCount: this.state.logoCount,
    });
  };

  handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    this.setState({ [name]: name === 'displayName' ? value : Number(value) } as any);
  };

  render() {
    // Redirect to lobby if room is created
    if (this.props.gameRoom.phase === 'lobby' && this.props.gameRoom.roomCode) {
      return <Navigate to={`/battle/lobby/${this.props.gameRoom.roomCode}`} replace />;
    }

    const { isConnecting, connectionError } = this.props.gameRoom;

    return (
      <div className="create-room container">
        <div className="header-wrapper">
          <Link to="/battle" className="header-back">
            <SVGBackArrow height="24px" />
          </Link>
          <h3 className="header-title">Create Battle Room</h3>
        </div>

        <div className="create-room__wrapper">
          <form onSubmit={this.handleSubmit} className="create-room__form">
            <div className="create-room__field">
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

            <div className="create-room__field">
              <label htmlFor="timeLimit">Game Duration (seconds)</label>
              <select
                id="timeLimit"
                name="timeLimit"
                value={this.state.timeLimit}
                onChange={this.handleChange}
              >
                <option value={60}>60 seconds</option>
                <option value={120}>120 seconds</option>
                <option value={180}>180 seconds</option>
                <option value={300}>300 seconds</option>
              </select>
            </div>

            <div className="create-room__field">
              <label htmlFor="logoCount">Number of Logos</label>
              <select
                id="logoCount"
                name="logoCount"
                value={this.state.logoCount}
                onChange={this.handleChange}
              >
                <option value={5}>5 logos</option>
                <option value={10}>10 logos</option>
                <option value={15}>15 logos</option>
                <option value={20}>20 logos</option>
              </select>
            </div>

            {connectionError && (
              <div className="create-room__error">{connectionError}</div>
            )}

            <button
              type="submit"
              className="create-room__submit main__button"
              disabled={isConnecting || !this.state.displayName.trim()}
            >
              {isConnecting ? 'Connecting...' : 'Create Room'}
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
  createRoom: (displayName: string, settings: any) => dispatch(createRoom(displayName, settings)),
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateRoom);
