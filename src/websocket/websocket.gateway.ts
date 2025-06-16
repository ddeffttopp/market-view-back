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
    this.logger.log(`Client connected: ${client.protocol}`);
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log(`Client disconnected.`);
    const fintachartsSocket = this.clientToFintachartsSocket.get(client);
    if (fintachartsSocket && fintachartsSocket.readyState === WebSocket.OPEN) {
      fintachartsSocket.close();
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(fintachartsSocket);
      this.logger.log('Fintacharts WebSocket connection closed due to client disconnect.');
    }
  }

  @SubscribeMessage('l1-subscription')
  async handleL1Subscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any,
  ): Promise<void> {
    this.logger.log(`Received L1 subscription from client for instrumentId: ${data.instrumentId}`);
    const token = data.token;
    const instrumentId = data.instrumentId;
    const provider = data.provider || 'oanda';

    if (!token) {
      this.logger.error('Token missing in l1-subscription message.');
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', message: 'Token is required for subscription.' }));
      }
      return;
    }

    const existingFintachartsSocket = this.clientToFintachartsSocket.get(client);
    if (existingFintachartsSocket && existingFintachartsSocket.readyState === WebSocket.OPEN) {
      existingFintachartsSocket.close();
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(existingFintachartsSocket);
      this.logger.log('Closed existing Fintacharts WebSocket connection for client.');
    }

    const fintachartsWsUrl = `wss://platform.fintacharts.com/api/streaming/ws/v1/realtime?token=${token}`;
    const fintachartsSocket = new WebSocket(fintachartsWsUrl);

    this.clientToFintachartsSocket.set(client, fintachartsSocket);
    this.fintachartsToClientSocket.set(fintachartsSocket, client);

    fintachartsSocket.onopen = () => {
      this.logger.log('Connected to Fintacharts WebSocket API.');
      const subscribeMessage = {
        type: 'l1-subscription',
        id: '1',
        instrumentId,
        provider,
        subscribe: true,
        kinds: ['ask', 'bid', 'last']
      };
      fintachartsSocket.send(JSON.stringify(subscribeMessage));
    };

    fintachartsSocket.onmessage = (event) => {
      const associatedClient = this.fintachartsToClientSocket.get(fintachartsSocket);
      if (associatedClient && associatedClient.readyState === WebSocket.OPEN) {
        associatedClient.send(event.data.toString());
      } else {
        this.logger.warn('Tried to send message to a closed or undefined client socket.');
        if (fintachartsSocket.readyState === WebSocket.OPEN) {
          fintachartsSocket.close();
        }
      }
    };

    fintachartsSocket.onerror = (error) => {
      this.logger.error('Fintacharts WebSocket Error:', error);
      const associatedClient = this.fintachartsToClientSocket.get(fintachartsSocket);
      if (associatedClient && associatedClient.readyState === WebSocket.OPEN) {
        associatedClient.send(JSON.stringify({ type: 'error', message: 'Fintacharts WebSocket connection error.' }));
      }
    };

    fintachartsSocket.onclose = () => {
      this.logger.warn('Fintacharts WebSocket connection closed.');
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(fintachartsSocket);
    };
  }

  @SubscribeMessage('l1-unsubscription')
  handleL1Unsubscription(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: any
  ): void {
    this.logger.log(`Received L1 unsubscription from client for instrumentId: ${data.instrumentId}`);
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
      this.logger.log('Sent unsubscription to Fintacharts.');
      fintachartsSocket.close();
      this.clientToFintachartsSocket.delete(client);
      this.fintachartsToClientSocket.delete(fintachartsSocket);
    }
  }
}
