import { describe, it, expect, jest } from '@jest/globals';
import {
  configureHelmet,
  configureCacheControl,
  configureTimeout,
  handleUploadErrors
} from '../../server/middleware.js';
import multer from 'multer';
import { CONFIG } from '../../server/config.js';

function mockReqResNext() {
  return {
    req: { path: '/api/test', setTimeout: jest.fn() },
    res: { set: jest.fn(), setTimeout: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() },
    next: jest.fn()
  };
}

describe('Middleware', () => {
  describe('configureHelmet', () => {
    it('returns a middleware function', () => {
      const middleware = configureHelmet();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('configureCacheControl', () => {
    it('sets Cache-Control header to no-cache', () => {
      const { req, res, next } = mockReqResNext();
      configureCacheControl(req, res, next);
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
    });

    it('calls next()', () => {
      const { req, res, next } = mockReqResNext();
      configureCacheControl(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('configureTimeout', () => {
    it('sets request timeout from config', () => {
      const { req, res, next } = mockReqResNext();
      configureTimeout(req, res, next);
      expect(req.setTimeout).toHaveBeenCalledWith(CONFIG.TIMEOUTS.REQUEST_MS);
    });

    it('sets response timeout from config', () => {
      const { req, res, next } = mockReqResNext();
      configureTimeout(req, res, next);
      expect(res.setTimeout).toHaveBeenCalledWith(CONFIG.TIMEOUTS.RESPONSE_MS);
    });

    it('calls next()', () => {
      const { req, res, next } = mockReqResNext();
      configureTimeout(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('handleUploadErrors', () => {
    it('returns 400 for LIMIT_FILE_SIZE', () => {
      const { req, res, next } = mockReqResNext();
      const error = new multer.MulterError('LIMIT_FILE_SIZE');
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: CONFIG.ERRORS.FILE_TOO_LARGE });
    });

    it('returns 400 for LIMIT_FILE_COUNT', () => {
      const { req, res, next } = mockReqResNext();
      const error = new multer.MulterError('LIMIT_FILE_COUNT');
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: CONFIG.ERRORS.TOO_MANY_FILES });
    });

    it('returns 400 for LIMIT_FIELD_VALUE', () => {
      const { req, res, next } = mockReqResNext();
      const error = new multer.MulterError('LIMIT_FIELD_VALUE');
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: CONFIG.ERRORS.FIELD_TOO_LARGE });
    });

    it('returns 400 for unknown MulterError', () => {
      const { req, res, next } = mockReqResNext();
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: `Upload error: ${error.message}` });
    });

    it('returns 400 for generic error with message', () => {
      const { req, res, next } = mockReqResNext();
      const error = new Error('Something broke');
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something broke' });
    });

    it('returns 400 with fallback message for error without message', () => {
      const { req, res, next } = mockReqResNext();
      const error = new Error();
      handleUploadErrors(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'An error occurred processing your request.' });
    });

    it('calls next() when no error', () => {
      const { req, res, next } = mockReqResNext();
      handleUploadErrors(null, req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
