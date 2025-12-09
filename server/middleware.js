import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { CONFIG } from './config.js';
import { getFileExtension } from './utils.js';
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: false, // Disabled to allow Tailwind CDN (will be removed in production)
    crossOriginEmbedderPolicy: false // Required for some external resources
  });
}
export function configureCacheControl(req, res, next) {
  if (req.path.match(/\.(jpg|jpeg|png|gif|ico|css|js|svg)$/)) {
    res.set('Cache-Control', `public, max-age=${CONFIG.CACHE.STATIC_ASSETS_MAX_AGE}`);
  } else {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
}
export function configureTimeout(req, res, next) {
  req.setTimeout(CONFIG.TIMEOUTS.REQUEST_MS);
  res.setTimeout(CONFIG.TIMEOUTS.RESPONSE_MS);
  next();
}
export const apiLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.MAX_REQUESTS,
  message: {
    error: CONFIG.ERRORS.RATE_LIMIT_EXCEEDED
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: CONFIG.ERRORS.RATE_LIMIT_EXCEEDED
    });
  }
});
export const strictLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT.WINDOW_MS,
  max: CONFIG.RATE_LIMIT.STRICT_MAX_REQUESTS,
  message: {
    error: CONFIG.ERRORS.STRICT_RATE_LIMIT_EXCEEDED
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: CONFIG.ERRORS.STRICT_RATE_LIMIT_EXCEEDED
    });
  }
});
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CONFIG.FILES.MAX_SIZE_BYTES,
    files: CONFIG.FILES.MAX_COUNT,
    fieldSize: CONFIG.FILES.MAX_FIELD_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = CONFIG.FILES.ALLOWED_MIMES;
    const fileExtension = getFileExtension(file.originalname);
    const allowedExtensions = CONFIG.FILES.ALLOWED_EXTENSIONS;

    // Security: Always validate extension to prevent MIME type spoofing
    if (!allowedExtensions.includes(fileExtension)) {
      cb(new Error(CONFIG.ERRORS.INVALID_FILE_EXTENSION(fileExtension)));
      return;
    }

    // Accept if MIME type is allowed (includes octet-stream for .md files)
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(CONFIG.ERRORS.INVALID_FILE_TYPE(file.mimetype)));
    }
  }
});
export function handleUploadErrors(error, req, res, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: CONFIG.ERRORS.FILE_TOO_LARGE });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: CONFIG.ERRORS.TOO_MANY_FILES });
    }
    if (error.code === 'LIMIT_FIELD_VALUE') {
      return res.status(400).json({ error: CONFIG.ERRORS.FIELD_TOO_LARGE });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  if (error) {
    return res.status(400).json({ error: error.message || 'An error occurred processing your request.' });
  }
  next();
}
