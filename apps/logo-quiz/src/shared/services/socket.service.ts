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

/**
 * SocketService supports two modes:
 * - Production: Native WebSocket to API Gateway (when environment.webSocketUrl is set)
 * - Development: Socket.io to NestJS backend (when webSocketUrl is not set)
 */
class SocketService {
  private socket: any = null; // socket.io socket
  private ws: WebSocket | null = null; // native WebSocket
  private eventListeners: Map<string, Set<Function>> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestId = 0;

  private get useNativeWebSocket(): boolean {
    return !!environment.webSocketUrl;
  }

  connect(): Promise<void> {
    if (this.useNativeWebSocket) {
      return this.connectNativeWebSocket();
    } else {
      return this.connectSocketIO();
    }
  }

  private connectNativeWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = environment.webSocketUrl!;
      console.log('Connecting to API Gateway WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.ws = null;
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };
    });
  }

  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const { action, requestId, ...payload } = message;

      console.log('WebSocket message:', action, payload);

      // Handle request/response pattern
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject } = this.pendingRequests.get(requestId)!;
        this.pendingRequests.delete(requestId);

        if (action === 'error') {
          reject(new Error(payload.message || 'Unknown error'));
        } else {
          resolve(payload);
        }
        return;
      }

      // Handle broadcast events - dispatch to listeners
      const listeners = this.eventListeners.get(action);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(payload);
          } catch (e) {
            console.error('Error in event listener:', e);
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }

  private connectSocketIO(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve();
        return;
      }

      // Get API URL and convert to WebSocket URL
      const apiUrl = environment.apiUrl.replace('/api', '');
      const token = localStorage.getItem('jwt');

      console.log('Connecting to Socket.io:', `${apiUrl}/game`);

      this.socket = io(`${apiUrl}/game`, {
        auth: token ? { token: `Bearer ${token}` } : undefined,
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Socket.io connected');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Socket.io connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log('Socket.io disconnected:', reason);
      });

      // Re-register event listeners for socket.io
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
    if (this.useNativeWebSocket) {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    } else {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    }
  }

  isConnected(): boolean {
    if (this.useNativeWebSocket) {
      return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    } else {
      return this.socket ? this.socket.connected : false;
    }
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

  gameTimeout(): Promise<void> {
    return this.emit<void, void>('game:timeout', undefined);
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
    if (this.useNativeWebSocket) {
      return this.emitNativeWebSocket<TData, TResponse>(event, data);
    } else {
      return this.emitSocketIO<TData, TResponse>(event, data);
    }
  }

  private emitNativeWebSocket<TData, TResponse>(action: string, data: TData): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // For fire-and-forget events, just send without tracking
      const message = JSON.stringify({ action, data });
      this.ws.send(message);

      // For API Gateway, responses come as separate messages via event listeners
      // Resolve immediately for commands that don't expect a direct response
      resolve(undefined as TResponse);
    });
  }

  private emitSocketIO<TData, TResponse>(event: string, data: TData): Promise<TResponse> {
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

    // For socket.io, also register directly with socket if connected
    if (!this.useNativeWebSocket && this.socket) {
      this.socket.on(event, callback);
    }

    // Return unsubscribe function
    return () => {
      const eventListeners = this.eventListeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
      if (!this.useNativeWebSocket && this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  removeAllListeners(): void {
    if (!this.useNativeWebSocket) {
      const socket = this.socket;
      this.eventListeners.forEach((callbacks, event) => {
        callbacks.forEach(callback => {
          if (socket) {
            socket.off(event, callback);
          }
        });
      });
    }
    this.eventListeners.clear();
    this.pendingRequests.clear();
  }
}

export const socketService = new SocketService();
