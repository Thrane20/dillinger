import winston from 'winston';
import 'winston-daily-rotate-file';
import Transport from 'winston-transport';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Custom transport to stream logs to the LoggerService instance
class StreamTransport extends Transport {
    private stream: EventEmitter;

    constructor(opts: any) {
        super(opts);
        this.stream = opts.stream;
    }

    log(info: any, callback: () => void) {
        setImmediate(() => {
            this.stream.emit('log', info);
        });
        callback();
    }
}

export class LoggerService extends EventEmitter {
  private logger: winston.Logger;
  private static instance: LoggerService;
  private logDirectory: string;

  private constructor() {
    super();
    // Determine log directory: use DILLINGER_ROOT/logs if available, otherwise ./logs
    const dillingerRoot = process.env.DILLINGER_ROOT || process.cwd();
    this.logDirectory = path.join(dillingerRoot, 'logs');

    // Ensure log directory exists
    if (!fs.existsSync(this.logDirectory)) {
      try {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
        // Fallback to current directory if permission denied
        this.logDirectory = path.join(process.cwd(), 'logs');
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
      })
    );

    this.logger = winston.createLogger({
      level: 'info',
      format: logFormat,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            logFormat
          ),
        }),
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logDirectory, 'dillinger-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '500m',
          maxFiles: '5d',
          format: logFormat,
        }),
        new StreamTransport({ stream: this }) as any
      ],
    });
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  public error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }
  
  public getLogDirectory(): string {
      return this.logDirectory;
  }
}

export const logger = LoggerService.getInstance();
