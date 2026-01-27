import io from 'socket.io-client';
import { environment } from '@logo-quiz/environment';
import {
  RoomStateDto,
  CreateRoomDto,
  JoinRoomDto,
  SubmitAnswerDto,
  GameLogoDto,
  AnswerResultDto,
  ScoreUpdateDto,
  FinalScoreboardDto,
} from '@logo-quiz/models';

export type SocketEventCallback<T> = (data: T) => void;

class SocketService {
  private socket: any = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve();
        return;
      }

      // Get API URL and convert to WebSocket URL
      const apiUrl = environment.apiUrl.replace('/api', '');
      const token = localStorage.getItem('jwt');

      this.socket = io(`${apiUrl}/game`, {
        auth: token ? { token: `Bearer ${token}` } : undefined,
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Socket connected');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
      });

      // Re-register event listeners
      const socket = this.socket;
      this.eventListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          if (socket) {
            socket.on(event, callback);
          }
        });
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket ? this.socket.connected : false;
  }

  // Room events
  createRoom(data: CreateRoomDto): Promise<{ roomCode: string; state: RoomStateDto }> {
    return this.emit<typeof data, { roomCode: string; state: RoomStateDto }>('room:create', data);
  }

  joinRoom(data: JoinRoomDto): Promise<{ roomCode: string; state: RoomStateDto } | { message: string }> {
    return this.emit<typeof data, { roomCode: string; state: RoomStateDto } | { message: string }>('room:join', data);
  }

  leaveRoom(): Promise<void> {
    return this.emit<void, void>('room:leave', undefined);
  }

  setReady(isReady: boolean): Promise<void> {
    return this.emit<{ isReady: boolean }, void>('room:ready', { isReady });
  }

  requestRoomState(): Promise<RoomStateDto> {
    return this.emit<void, RoomStateDto>('room:state-request', undefined);
  }

  // Game events
  startGame(): Promise<void> {
    return this.emit<void, void>('game:start', undefined);
  }

  submitAnswer(data: SubmitAnswerDto): Promise<void> {
    return this.emit<typeof data, void>('game:answer', data);
  }

  // Event listeners
  onRoomState(callback: SocketEventCallback<RoomStateDto>): () => void {
    return this.on('room:state', callback);
  }

  onRoomCreated(callback: SocketEventCallback<{ roomCode: string; state: RoomStateDto }>): () => void {
    return this.on('room:created', callback);
  }

  onRoomJoined(callback: SocketEventCallback<{ roomCode: string; state: RoomStateDto }>): () => void {
    return this.on('room:joined', callback);
  }

  onRoomError(callback: SocketEventCallback<{ message: string }>): () => void {
    return this.on('room:error', callback);
  }

  onRoomCancelled(callback: SocketEventCallback<{ reason: string }>): () => void {
    return this.on('room:cancelled', callback);
  }

  onGameStarted(callback: SocketEventCallback<{ totalLogos: number; timeLimit: number }>): () => void {
    return this.on('game:started', callback);
  }

  onGameLogo(callback: SocketEventCallback<GameLogoDto>): () => void {
    return this.on('game:logo', callback);
  }

  onAnswerResult(callback: SocketEventCallback<AnswerResultDto>): () => void {
    return this.on('game:answer-result', callback);
  }

  onScoreUpdate(callback: SocketEventCallback<ScoreUpdateDto>): () => void {
    return this.on('game:score-update', callback);
  }

  onGameTimer(callback: SocketEventCallback<{ timeRemaining: number }>): () => void {
    return this.on('game:timer', callback);
  }

  onGameEnd(callback: SocketEventCallback<FinalScoreboardDto>): () => void {
    return this.on('game:end', callback);
  }

  onAnswerRevealed(callback: SocketEventCallback<{ answer: string; solvedBy: string; logoIndex: number }>): () => void {
    return this.on('game:answer-revealed', callback);
  }

  // Generic event methods
  private emit<TData, TResponse>(event: string, data: TData): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(event, data, (response: { event: string; data: TResponse }) => {
        if (response && response.event && response.event.includes('error')) {
          const errorData = response.data as any;
          reject(new Error((errorData && errorData.message) || 'Unknown error'));
        } else {
          resolve(response && response.data);
        }
      });
    });
  }

  private on<T>(event: string, callback: SocketEventCallback<T>): () => void {
    // Store the callback
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }

    // Register with socket if connected
    if (this.socket) {
      this.socket.on(event, callback);
    }

    // Return unsubscribe function
    return () => {
      const eventListeners = this.eventListeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  removeAllListeners(): void {
    const socket = this.socket;
    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        if (socket) {
          socket.off(event, callback);
        }
      });
    });
    this.eventListeners.clear();
  }
}

export const socketService = new SocketService();
