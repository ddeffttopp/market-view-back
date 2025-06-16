import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: 'https://ddeffttopp.github.io',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() wss: Server;
  private readonly logger = new Logger(WebsocketGateway.name);

  private clientToFintachartsSocket = new Map<WebSocket, WebSocket>();
  private fintachartsToClientSocket = new Map<WebSocket, WebSocket>();

  async handleConnection(client: WebSocket, ...args: any[]) {
    this.logger.log(`[Client WS] New client connected. Client IP/Protocol: ${client.protocol || 'N/A'}`);
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log(`[Client WS] Client disconnected.`);
    const fintachartsSocket = this.clientToFintachartsSocket.get(client);
    if (fintachartsSocket) {
      if (fintachartsSocket.readyState === WebSocket.OPEN) {
        fintachartsSocket.close();
        this.logger.log('[Fintacharts WS] Fintacharts WebSocket connection closed due to client disconnect.');
      } else {
        this.logger.warn(`[Fintacharts WS] Fintacharts socket was not OPEN, state: ${fintachartsSocket.readyState}. Cleaning up map.`);
      }
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(fintachartsSocket);
    } else {
      this.logger.warn('[Client WS] Disconnected client had no associated Fintacharts socket. Clean disconnect.');
    }
  }

  @SubscribeMessage('l1-subscription')
  async handleL1Subscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ): Promise<void> {
    this.logger.log(`[Client WS] Received L1 subscription from client.`);
    this.logger.log(`[Client WS] Subscription Data: ${JSON.stringify(data)}`);
    const token = data.token;
    const instrumentId = data.instrumentId;
    const provider = data.provider || 'oanda';

    if (!token) {
      this.logger.error('[Client WS] Token missing in l1-subscription message. Sending error to client.');
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', message: 'Token is required for subscription.' }));
      }
      if (client.readyState === WebSocket.OPEN) {
        client.close(1008, 'Token missing');
        this.logger.log('[Client WS] Client socket closed due to missing token.');
      }
      return;
    }

    this.logger.log(`[Client WS] Instrument ID: ${instrumentId}, Provider: ${provider}, Token received: ${token ? token.substring(0, 10) + '...' : 'N/A'}`);

    const existingFintachartsSocket = this.clientToFintachartsSocket.get(client);
    if (existingFintachartsSocket) {
      if (existingFintachartsSocket.readyState === WebSocket.OPEN) {
        existingFintachartsSocket.close();
        this.logger.log('[Fintacharts WS] Closed existing Fintacharts WebSocket connection for client due to new subscription.');
      } else {
        this.logger.warn(`[Fintacharts WS] Existing Fintacharts socket was not OPEN, state: ${existingFintachartsSocket.readyState}. Cleaning up map.`);
      }
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(existingFintachartsSocket);
    }

    const fintachartsWsUrl = `wss://platform.fintacharts.com/api/streaming/ws/v1/realtime?token=${token}`;
    this.logger.log(`[Fintacharts WS] Attempting to connect to Fintacharts URL: ${fintachartsWsUrl.substring(0, 70)}...`); // Лог части URL
    const fintachartsSocket = new WebSocket(fintachartsWsUrl);

    this.clientToFintachartsSocket.set(client, fintachartsSocket);
    this.fintachartsToClientSocket.set(fintachartsSocket, client);

    fintachartsSocket.onopen = () => {
      this.logger.log('[Fintacharts WS] Successfully connected to Fintacharts WebSocket API.');
      const subscribeMessage = {
        type: 'l1-subscription',
        id: '1',
        instrumentId,
        provider,
        subscribe: true,
        kinds: ['ask', 'bid', 'last']
      };
      fintachartsSocket.send(JSON.stringify(subscribeMessage));
      this.logger.log(`[Fintacharts WS] Sent subscription message to Fintacharts for: ${instrumentId}`);
    };

    fintachartsSocket.onmessage = (event) => {
      const associatedClient = this.fintachartsToClientSocket.get(fintachartsSocket);
      if (associatedClient && associatedClient.readyState === WebSocket.OPEN) {
        associatedClient.send(event.data.toString());
      } else {
        this.logger.warn(`[Client WS] Tried to send message to a closed or undefined client socket. State: ${associatedClient?.readyState}`);
        if (fintachartsSocket.readyState === WebSocket.OPEN) {
          fintachartsSocket.close(1001, 'Client disconnected');
          this.logger.log('[Fintacharts WS] Closing Fintacharts socket because associated client is not open.');
        }
      }
    };

    fintachartsSocket.onerror = (errorEvent: Event) => {
      this.logger.error(`[Fintacharts WS] Error received from Fintacharts socket: ${errorEvent.type}. Details:`, errorEvent);
      const associatedClient = this.fintachartsToClientSocket.get(fintachartsSocket);
      if (associatedClient && associatedClient.readyState === WebSocket.OPEN) {
        associatedClient.send(JSON.stringify({ type: 'error', message: 'Fintacharts WebSocket connection error. Please try again.' }));
        this.logger.log('[Client WS] Sent error message to client due to Fintacharts error.');
      } else {
        this.logger.warn('[Client WS] Associated client not open to send Fintacharts error.');
      }
    };

    fintachartsSocket.onclose = (event: CloseEvent) => {
      this.logger.warn(`[Fintacharts WS] Fintacharts WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}. Was clean: ${event.wasClean}`);
      const associatedClient = this.fintachartsToClientSocket.get(fintachartsSocket);
      if (associatedClient) {
        this.clientToFintachartsSocket.delete(associatedClient);
      }
      this.fintachartsToClientSocket.delete(fintachartsSocket);
      this.logger.log('[Fintacharts WS] Cleaned up map entries for Fintacharts socket.');
    };
  }

  @SubscribeMessage('l1-unsubscription')
  handleL1Unsubscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any
  ): void {
    this.logger.log(`[Client WS] Received L1 unsubscription from client for instrumentId: ${data.instrumentId}`);
    this.logger.log(`[Client WS] Unsubscription Data: ${JSON.stringify(data)}`);

    const fintachartsSocket = this.clientToFintachartsSocket.get(client);
    if (fintachartsSocket && fintachartsSocket.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        type: 'l1-subscription',
        id: '1',
        instrumentId: data.instrumentId,
        provider: data.provider || 'oanda',
        subscribe: false,
        kinds: ['ask', 'bid', 'last']
      };
      fintachartsSocket.send(JSON.stringify(unsubscribeMessage));
      this.logger.log('[Fintacharts WS] Sent unsubscription message to Fintacharts.');
      fintachartsSocket.close();
      this.logger.log('[Fintacharts WS] Fintacharts socket closed after unsubscription.');
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(fintachartsSocket);
    } else {
      this.logger.warn('[Client WS] No active Fintacharts socket found for unsubscription request.');
    }
  }
}
