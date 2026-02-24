"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LoggerService = void 0;
const winston_1 = __importDefault(require("winston"));
require("winston-daily-rotate-file");
const winston_transport_1 = __importDefault(require("winston-transport"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("events");
// Custom transport to stream logs to the LoggerService instance
class StreamTransport extends winston_transport_1.default {
    stream;
    constructor(opts) {
        super(opts);
        this.stream = opts.stream;
    }
    log(info, callback) {
        setImmediate(() => {
            this.stream.emit('log', info);
        });
        callback();
    }
}
class LoggerService extends events_1.EventEmitter {
    logger;
    static instance;
    logDirectory;
    constructor() {
        super();
        // Determine log directory: use DILLINGER_CORE_PATH/logs if available, otherwise ./logs
        const dillingerCorePath = process.env.DILLINGER_CORE_PATH || process.cwd();
        this.logDirectory = path_1.default.join(dillingerCorePath, 'logs');
        // Ensure log directory exists
        if (!fs_1.default.existsSync(this.logDirectory)) {
            try {
                fs_1.default.mkdirSync(this.logDirectory, { recursive: true });
            }
            catch (error) {
                console.error('Failed to create log directory:', error);
                // Fallback to current directory if permission denied
                this.logDirectory = path_1.default.join(process.cwd(), 'logs');
                fs_1.default.mkdirSync(this.logDirectory, { recursive: true });
            }
        }
        const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
        }));
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: logFormat,
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat),
                }),
                new winston_1.default.transports.DailyRotateFile({
                    filename: path_1.default.join(this.logDirectory, 'dillinger-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '500m',
                    maxFiles: '5d',
                    format: logFormat,
                }),
                new StreamTransport({ stream: this })
            ],
        });
    }
    static getInstance() {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    getLogDirectory() {
        return this.logDirectory;
    }
}
exports.LoggerService = LoggerService;
exports.logger = LoggerService.getInstance();
