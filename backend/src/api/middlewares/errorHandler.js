const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors'); // Import the base custom error

// This middleware catches errors passed by next(error)
const errorHandler = (err, req, res, next) => {
  // Enhanced logging with more context
  logger.error(
    `${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${
      req.method
    } - ${req.ip}`,
    {
      stack: err.stack,
    }
  );

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';
  let status = err.status || 'error';

  // Check if it's an operational error we created (from errors.js)
  const isOperational = err.isOperational || err instanceof ApiError;

  if (process.env.NODE_ENV === 'production') {
    if (isOperational) {
      // Operational, trusted error: send specific message to client
      return res.status(statusCode).json({
        success: false,
        status: status,
        message: message,
      });
    }

    // Programming or other unknown error: don't leak error details
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'An unexpected error occurred.',
    });
  }

  // In development, send detailed error
  return res.status(statusCode).json({
    success: false,
    status: status,
    message: message,
    stack: err.stack,
  });
};

module.exports = errorHandler;
