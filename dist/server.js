"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config"));
const seedAdmin_1 = require("./DB/seedAdmin");
const socketHelper_1 = require("./helpers/socketHelper");
const logger_1 = require("./shared/logger");
const CacheHelper_1 = require("./app/shared/CacheHelper");
const bannerGenerator_1 = require("./shared/bannerGenerator");
const startupSummary_1 = require("./shared/startupSummary");
const spinnerHelper_1 = require("./shared/spinnerHelper");
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(['8.8.8.8', '8.8.4.4']);
// uncaught exception — ensure server closes before exit to avoid EADDRINUSE on respawn
process.on('uncaughtException', error => {
    logger_1.errorLogger.error('UncaughtException Detected', error);
    if (server && typeof server.close === 'function') {
        try {
            server.close(() => {
                // small delay so OS can release the port cleanly
                setTimeout(() => process.exit(1), 500);
            });
        }
        catch (e) {
            // fallback if close throws
            setTimeout(() => process.exit(1), 500);
        }
    }
    else {
        process.exit(1);
    }
});
let server;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            // Display banner if enabled
            if (config_1.default.banner.enabled) {
                const banner = yield (0, bannerGenerator_1.generateDefaultBanner)(config_1.default.app.name, config_1.default.app.tagline, config_1.default.app.version, config_1.default.node_env || 'unknown', config_1.default.port || 5000, config_1.default.banner.style);
                // Use console.log ONLY for banner (exception to no-console-log rule)
                // Banner displays before Winston logger initialization
                // eslint-disable-next-line no-console
                console.log('\n' + banner + '\n');
            }
            // Track startup status for beautiful summary
            const startupStatus = {
                environment: config_1.default.node_env || 'unknown',
                debugMode: config_1.default.node_env === 'development',
                rateLimit: true, // Always active in this setup
                socketIO: false,
                database: { status: 'disconnected' },
                cache: { status: 'disabled' },
            };
            // Connect to database
            const dbSpinner = (0, spinnerHelper_1.createSpinner)({ text: 'Connecting to MongoDB...', color: 'cyan' });
            try {
                yield mongoose_1.default.connect(config_1.default.database_url);
                dbSpinner.succeed('MongoDB connected successfully');
                startupStatus.database = {
                    status: 'connected',
                    message: 'MongoDB connected successfully',
                };
            }
            catch (dbError) {
                dbSpinner.fail('MongoDB connection failed');
                logger_1.errorLogger.error('❌ MongoDB connection error:', dbError);
                throw dbError;
            }
            // Seed Super Admin after database connection is successful
            const seedSpinner = (0, spinnerHelper_1.createSpinner)({ text: 'Verifying super admin account...', color: 'cyan' });
            try {
                yield (0, seedAdmin_1.seedSuperAdmin)();
                seedSpinner.succeed('Super admin ready');
            }
            catch (seedError) {
                seedSpinner.fail('Super admin verification failed');
                logger_1.errorLogger.error('❌ Super admin seeding error:', seedError);
                throw seedError;
            }
            // Initialize CacheHelper (in-memory)
            const cacheSpinner = (0, spinnerHelper_1.createSpinner)({ text: 'Initializing cache system...', color: 'cyan' });
            const cache = CacheHelper_1.CacheHelper.getInstance();
            cacheSpinner.succeed('In-memory cache initialized');
            startupStatus.cache = {
                status: 'initialized',
                message: 'In-memory cache ready',
            };
            // Validate performance thresholds
            if ((_b = (_a = config_1.default.tracing) === null || _a === void 0 ? void 0 : _a.performance) === null || _b === void 0 ? void 0 : _b.enabled) {
                const thresholdSpinner = (0, spinnerHelper_1.createSpinner)({
                    text: 'Validating performance thresholds...',
                    color: 'cyan'
                });
                try {
                    const { validateAndWarnThresholds } = yield Promise.resolve().then(() => __importStar(require('./app/logging/thresholdValidator')));
                    validateAndWarnThresholds(config_1.default.tracing.performance.thresholds);
                    thresholdSpinner.succeed('Performance config validated');
                }
                catch (err) {
                    thresholdSpinner.warn('Threshold validation skipped');
                    logger_1.errorLogger.error('Threshold validation failed:', err);
                    // Don't throw - let server start but warn about potential issues
                }
            }
            const port = Number(config_1.default.port) || 5001;
            const host = config_1.default.node_env === 'development'
                ? '0.0.0.0'
                : (config_1.default.ip_address && String(config_1.default.ip_address).trim()) || '0.0.0.0';
            const serverSpinner = (0, spinnerHelper_1.createSpinner)({
                text: `Starting HTTP server on ${host}:${port}...`,
                color: 'cyan'
            });
            server = app_1.default.listen(port, host, () => {
                const url = `http://${host}:${port}/`;
                serverSpinner.succeed(`Server is listening at ${url}`);
                // Store server info
                startupStatus.server = { url, host, port };
                // Initialize Socket.IO
                const socketSpinner = (0, spinnerHelper_1.createSpinner)({
                    text: 'Initializing Socket.IO server...',
                    color: 'cyan'
                });
                const io = new socket_io_1.Server(server, {
                    pingTimeout: 60000,
                    cors: {
                        origin: '*',
                    },
                });
                socketHelper_1.socketHelper.socket(io);
                //@ts-ignore
                global.io = io;
                socketSpinner.succeed('Socket.IO ready for real-time connections');
                startupStatus.socketIO = true;
                // Add timestamp
                startupStatus.timestamp = new Date().toLocaleString('en-US', {
                    timeZone: 'Asia/Dhaka',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                });
                // Generate and display beautiful startup summary
                const summary = (0, startupSummary_1.generateStartupSummary)(startupStatus, {
                    style: 'compact', // Options: 'compact', 'progress', 'minimal'
                    borderStyle: config_1.default.banner.style,
                    width: 63,
                    colors: true,
                });
                // Use console.log ONLY for startup summary (exception to no-console-log rule)
                // This ensures the summary appears cleanly without Winston formatting
                // eslint-disable-next-line no-console
                console.log('\n' + summary + '\n');
            });
            // handle listen errors gracefully
            server.on('error', (err) => {
                if (err && err.code === 'EADDRINUSE') {
                    logger_1.errorLogger.error(`⚠️ Port in use ${host}:${port} (EADDRINUSE)`);
                    // attempt a graceful retry after closing
                    try {
                        server.close(() => {
                            setTimeout(() => {
                                server = app_1.default.listen(port, host, () => {
                                    logger_1.logger.info(`♻️ Re-listened on ${host}:${port} after EADDRINUSE`);
                                });
                            }, 1000);
                        });
                    }
                    catch (closeErr) {
                        logger_1.errorLogger.error('Failed to close server after EADDRINUSE', closeErr);
                    }
                }
            });
        }
        catch (error) {
            logger_1.errorLogger.error('❌ Server startup failed');
            (0, logger_1.notifyCritical)('Server Startup Failed', (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error');
            // Exit if startup fails
            process.exit(1);
        }
        //handle unhandleRejection
        process.on('unhandledRejection', error => {
            if (server) {
                server.close(() => {
                    logger_1.errorLogger.error('❌ UnhandledRejection Detected');
                    (0, logger_1.notifyCritical)('Unhandled Rejection', (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error');
                    process.exit(1);
                });
            }
            else {
                process.exit(1);
            }
        });
    });
}
main();
//SIGTERM
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM IS RECEIVE');
    if (server) {
        server.close();
    }
});
