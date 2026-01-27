import { Injectable } from '@nestjs/common';

export interface GameTimer {
  roomCode: string;
  startTime: number;
  duration: number; // seconds
  intervalId?: any;
  onTick?: (timeRemaining: number) => void;
  onEnd?: () => void;
}

@Injectable()
export class GameTimerService {
  private timers: Map<string, GameTimer> = new Map();

  startTimer(
    roomCode: string,
    duration: number,
    onTick: (timeRemaining: number) => void,
    onEnd: () => void,
  ): void {
    // Clear existing timer if any
    this.stopTimer(roomCode);

    const timer: GameTimer = {
      roomCode,
      startTime: Date.now(),
      duration,
      onTick,
      onEnd,
    };

    // Run tick every second
    timer.intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);

      if (onTick) {
        onTick(remaining);
      }

      if (remaining <= 0) {
        this.stopTimer(roomCode);
        if (onEnd) {
          onEnd();
        }
      }
    }, 1000);

    this.timers.set(roomCode, timer);
  }

  stopTimer(roomCode: string): void {
    const timer = this.timers.get(roomCode);
    if (timer && timer.intervalId) {
      clearInterval(timer.intervalId);
    }
    this.timers.delete(roomCode);
  }

  getTimeRemaining(roomCode: string): number {
    const timer = this.timers.get(roomCode);
    if (!timer) return 0;

    const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
    return Math.max(0, timer.duration - elapsed);
  }

  getElapsedTime(roomCode: string): number {
    const timer = this.timers.get(roomCode);
    if (!timer) return 0;

    return Date.now() - timer.startTime;
  }

  isTimerRunning(roomCode: string): boolean {
    return this.timers.has(roomCode);
  }
}
