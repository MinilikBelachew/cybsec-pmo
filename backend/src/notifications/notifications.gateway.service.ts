import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionActivityService } from '../auth/session-activity.service';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { AllConfigType } from '../config/config.type';
import {
  NOTIFICATIONS_SOCKET_NAMESPACE,
  notificationUserRoom,
} from './notifications.constants';
import { NotificationsGateway } from './notifications.gateway';

type AuthenticatedSocket = Socket & {
  data: {
    user?: JwtPayloadType;
  };
};

@WebSocketGateway({
  namespace: NOTIFICATIONS_SOCKET_NAMESPACE,
  cors: {
    origin: process.env.FRONTEND_DOMAIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGatewayService
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGatewayService.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly notificationsGateway: NotificationsGateway,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly sessionActivityService: SessionActivityService,
  ) {}

  afterInit(server: Server): void {
    this.notificationsGateway.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractAccessToken(client);
      if (!token) {
        this.logger.warn(`Socket connection rejected: missing token (${client.id})`);
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayloadType>(token, {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
      });

      if (!payload.id || !payload.sessionId) {
        client.disconnect(true);
        return;
      }

      await this.sessionActivityService.assertActive(payload.sessionId, {
        userId: payload.id,
        isExternal: payload.isExternal === true,
      });

      client.data.user = payload;
      await client.join(notificationUserRoom(payload.id));
      this.logger.debug(`Socket connected for user ${payload.id}`);
    } catch (error) {
      this.logger.warn(`Socket auth failed (${client.id})`, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket): void {
    const userId = client.data.user?.id;
    if (userId) {
      this.logger.debug(`Socket disconnected for user ${userId}`);
    }
  }

  private extractAccessToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('access_token='));

    if (!match) {
      return null;
    }

    return decodeURIComponent(match.slice('access_token='.length));
  }
}
