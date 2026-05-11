import cors from 'cors';
import YAML from 'yamljs';
import './app/logging/mongooseMetrics';
import './app/logging/autoLabelBootstrap';
import './app/logging/opentelemetry';
import './app/logging/patchBcrypt';
import './app/logging/patchJWT';
import router from './routes';
import { Morgan } from './shared/morgen';
import swaggerUi from 'swagger-ui-express';
import { StatusCodes } from 'http-status-codes';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import { requestContextInit } from './app/logging/requestContext';
import { clientInfo } from './app/logging/clientInfo';
import { requestLogger } from './app/logging/requestLogger';
import { otelExpressMiddleware } from './app/logging/otelExpress';
import fs from 'fs';
import path from 'path';
import { allowedOrigins, maybeLogCors } from './app/logging/corsLogger';
// autoLabelBootstrap moved above router import to ensure controllers are wrapped before route binding

const app = express();


// Morgan logging
app.use(Morgan.successHandler);
app.use(Morgan.errorHandler);

// Client Hints: request OS/device info from browsers without frontend changes
app.use((req, res, next) => {
  // Ask for high-entropy client hints (Chrome/Edge)
  res.setHeader(
    'Accept-CH',
    [
      'Sec-CH-UA',
      'Sec-CH-UA-Platform',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Model',
      'Sec-CH-UA-Arch',
      'Sec-CH-UA-Bitness',
    ].join(', '),
  );

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
  res.setHeader(
    'Vary',
    existingVary ? String(existingVary) + ', ' + varyHeaders : varyHeaders,
  );

  // Encourage first-request delivery (Chrome only)
  res.setHeader(
    'Critical-CH',
    [
      'Sec-CH-UA-Platform',
      'Sec-CH-UA-Platform-Version',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Model',
    ].join(', '),
  );

  next();
});

// OpenTelemetry middleware for timeline spans
app.use(otelExpressMiddleware);

// CORS setup moved to logging/corsLogger.ts (allowedOrigins, maybeLogCors)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman)
      if (!origin) {
        maybeLogCors(origin, true);
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        maybeLogCors(origin, true);
        callback(null, true);
      } else {
        maybeLogCors(origin, false);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true, // allow cookies/auth headers
  }),
);

// Explicitly handle preflight OPTIONS requests
app.options(
  '*',
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  }),
);

// Body parser
// Apple Server Notifications V2 require the raw request body so the JWS
// signature can be verified against the original bytes. This MUST be
// registered before the generic express.json() middleware below.
app.use(
  '/api/v1/subscriptions/apple/webhook',
  express.raw({ type: 'application/json' })
);

// Google Play RTDN webhook (Pub/Sub push) — keep raw bytes so the
// service can decode the base64 message.data exactly as sent. Must be
// registered before express.json() below.
app.use(
  '/api/v1/subscriptions/google/webhook',
  express.raw({ type: 'application/json' })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (for reading refresh tokens from cookies)
app.use(cookieParser());

// Request/Response logging
// Initialize request-scoped context BEFORE logging
app.use(requestContextInit);
// Detect device/OS/browser from headers (Client Hints + UA fallback)
app.use(clientInfo);
app.use(requestLogger);

// Static files
app.use(express.static('uploads'));
app.use('/uploads', express.static('uploads'));
app.use(express.static('public'));

// Swagger
const swaggerPath = path.join(__dirname, '../public/swagger.yaml');
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = YAML.load(swaggerPath);
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// API routes
app.use('/api/v1', router);

// Live response
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/serverLiveWallpaper.html'));
});

// Global error handler
app.use(globalErrorHandler);

// 404 handler
app.use((req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
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

export default app;
