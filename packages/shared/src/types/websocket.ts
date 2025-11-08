/**
 * WebSocket message types for real-time communication
 */

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage<T = any> {
  type: string;
  body: T;
}

/**
 * Log entry message body
 */
export interface LogEntryBody {
  containerId: string;
  containerType: 'install' | 'launch';
  gameName: string;
  gameId: string;
  message: string;
  timestamp: string;
}

/**
 * Log entry WebSocket message
 */
export interface LogEntryMessage extends WebSocketMessage<LogEntryBody> {
  type: 'logentry';
  body: LogEntryBody;
}

/**
 * Container started message
 */
export interface ContainerStartedBody {
  containerId: string;
  containerType: 'install' | 'launch';
  gameName: string;
  gameId: string;
}

export interface ContainerStartedMessage extends WebSocketMessage<ContainerStartedBody> {
  type: 'container-started';
  body: ContainerStartedBody;
}

/**
 * Container stopped message
 */
export interface ContainerStoppedBody {
  containerId: string;
  containerType: 'install' | 'launch';
  gameName: string;
  gameId: string;
  exitCode: number;
}

export interface ContainerStoppedMessage extends WebSocketMessage<ContainerStoppedBody> {
  type: 'container-stopped';
  body: ContainerStoppedBody;
}

/**
 * Union type of all WebSocket messages
 */
export type DillingerWebSocketMessage = 
  | LogEntryMessage 
  | ContainerStartedMessage 
  | ContainerStoppedMessage;
