"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const yamljs_1 = __importDefault(require("yamljs"));
require("./app/logging/mongooseMetrics");
require("./app/logging/autoLabelBootstrap");
require("./app/logging/opentelemetry");
require("./app/logging/patchBcrypt");
require("./app/logging/patchJWT");
const routes_1 = __importDefault(require("./routes"));
const morgen_1 = require("./shared/morgen");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const http_status_codes_1 = require("http-status-codes");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const globalErrorHandler_1 = __importDefault(require("./app/middlewares/globalErrorHandler"));
const requestContext_1 = require("./app/logging/requestContext");
const clientInfo_1 = require("./app/logging/clientInfo");
const requestLogger_1 = require("./app/logging/requestLogger");
const otelExpress_1 = require("./app/logging/otelExpress");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const corsLogger_1 = require("./app/logging/corsLogger");
// autoLabelBootstrap moved above router import to ensure controllers are wrapped before route binding
const app = (0, express_1.default)();
// Morgan logging
app.use(morgen_1.Morgan.successHandler);
app.use(morgen_1.Morgan.errorHandler);
// Client Hints: request OS/device info from browsers without frontend changes
app.use((req, res, next) => {
    // Ask for high-entropy client hints (Chrome/Edge)
    res.setHeader('Accept-CH', [
        'Sec-CH-UA',
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Arch',
        'Sec-CH-UA-Bitness',
    ].join(', '));
    // Vary to keep caches/proxies from mixing responses across devices
    const varyHeaders = [
        'User-Agent',
        'Sec-CH-UA',
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
        'Sec-CH-UA-Arch',
        'Sec-CH-UA-Bitness',
    ].join(', ');
    const existingVary = res.getHeader('Vary');
    res.setHeader('Vary', existingVary ? String(existingVary) + ', ' + varyHeaders : varyHeaders);
    // Encourage first-request delivery (Chrome only)
    res.setHeader('Critical-CH', [
        'Sec-CH-UA-Platform',
        'Sec-CH-UA-Platform-Version',
        'Sec-CH-UA-Mobile',
        'Sec-CH-UA-Model',
    ].join(', '));
    next();
});
// OpenTelemetry middleware for timeline spans
app.use(otelExpress_1.otelExpressMiddleware);
// CORS setup moved to logging/corsLogger.ts (allowedOrigins, maybeLogCors)
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman)
        if (!origin) {
            (0, corsLogger_1.maybeLogCors)(origin, true);
            return callback(null, true);
        }
        if (corsLogger_1.allowedOrigins.includes(origin)) {
            (0, corsLogger_1.maybeLogCors)(origin, true);
            callback(null, true);
        }
        else {
            (0, corsLogger_1.maybeLogCors)(origin, false);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true, // allow cookies/auth headers
}));
// Explicitly handle preflight OPTIONS requests
app.options('*', (0, cors_1.default)({
    origin: corsLogger_1.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
}));
// Body parser
// Apple Server Notifications V2 require the raw request body so the JWS
// signature can be verified against the original bytes. This MUST be
// registered before the generic express.json() middleware below.
app.use('/api/v1/subscriptions/apple/webhook', express_1.default.raw({ type: 'application/json' }));
// Google Play RTDN webhook (Pub/Sub push) — keep raw bytes so the
// service can decode the base64 message.data exactly as sent. Must be
// registered before express.json() below.
app.use('/api/v1/subscriptions/google/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Cookie parser (for reading refresh tokens from cookies)
app.use((0, cookie_parser_1.default)());
// Request/Response logging
// Initialize request-scoped context BEFORE logging
app.use(requestContext_1.requestContextInit);
// Detect device/OS/browser from headers (Client Hints + UA fallback)
app.use(clientInfo_1.clientInfo);
app.use(requestLogger_1.requestLogger);
// Static files
app.use(express_1.default.static('uploads'));
app.use('/uploads', express_1.default.static('uploads'));
app.use(express_1.default.static('public'));
// Swagger
const swaggerPath = path_1.default.join(__dirname, '../public/swagger.yaml');
if (fs_1.default.existsSync(swaggerPath)) {
    const swaggerDocument = yamljs_1.default.load(swaggerPath);
    app.use('/api/v1/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
}
// API routes
app.use('/api/v1', routes_1.default);
// Live response
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/serverLiveWallpaper.html'));
});
// Global error handler
app.use(globalErrorHandler_1.default);
// 404 handler
app.use((req, res) => {
    res.status(http_status_codes_1.StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Not found',
        errorMessages: [
            {
                path: req.originalUrl,
                message: "API DOESN'T EXIST",
            },
        ],
    });
});
exports.default = app;
