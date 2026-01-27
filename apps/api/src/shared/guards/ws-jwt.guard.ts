import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // For the game, we allow guests, so this guard is optional
    // It extracts user info if available but doesn't block unauthorized users
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromClient(client);

      if (token) {
        const payload = this.jwtService.verify(token);
        client.data.user = payload;
      }
    } catch (error) {
      // Token invalid, but we allow guests, so continue
      // User will be treated as guest
    }

    return true;
  }

  private extractTokenFromClient(client: Socket): string | null {
    // Try to get token from handshake auth
    const handshake = client.handshake;
    if (!handshake) return null;

    const auth = handshake.auth as any;
    const headers = handshake.headers;
    const authHeader = (auth && auth.token) || (headers && headers.authorization);

    if (!authHeader) return null;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }
}

// Strict version that requires authentication
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromClient(client);

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      return true;
    } catch (error) {
      throw new WsException('Unauthorized');
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    const handshake = client.handshake;
    if (!handshake) return null;

    const auth = handshake.auth as any;
    const headers = handshake.headers;
    const authHeader = (auth && auth.token) || (headers && headers.authorization);

    if (!authHeader) return null;

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }
}
