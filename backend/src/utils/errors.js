// Base class for all custom API errors
class ApiError extends Error {
  /**
   * Creates an ApiError.
   * @param {string} message - The error message.
   * @param {number} [statusCode=500] - The HTTP status code.
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    // Log stack trace in development
    if (process.env.NODE_ENV === 'development') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// 400 Bad Request
class BadRequestError extends ApiError {
  /**
   * Creates a BadRequestError.
   * @param {string} [message='Bad Request'] - The error message.
   */
  constructor(message = 'Bad Request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

// 401 Unauthorized
class UnauthorizedError extends ApiError {
  /**
   * Creates an UnauthorizedError.
   * @param {string} [message='Unauthorized'] - The error message.
   */
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

// 403 Forbidden
class ForbiddenError extends ApiError {
  /**
   * Creates a ForbiddenError.
   * @param {string} [message='Forbidden'] - The error message.
   */
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

// 404 Not Found
class NotFoundError extends ApiError {
  /**
   * Creates a NotFoundError.
   * @param {string} [message='Not Found'] - The error message.
   */
  constructor(message = 'Not Found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

// 409 Conflict
class ConflictError extends ApiError {
  /**
   * Creates a ConflictError.
   * @param {string} [message='Conflict'] - The error message.
   */
  constructor(message = 'Conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

// 500 Custom error for blockchain-specific failures
class BlockchainError extends ApiError {
  /**
   * Creates a BlockchainError.
   * @param {string} [message='Blockchain transaction failed'] - The error message.
   * @param {string} [functionName=''] - The name of the contract function that failed.
   */
  constructor(message = 'Blockchain transaction failed', functionName = '') {
    // Pass a 500 (Internal Server Error) status code by default for tx failures
    super(message, 500);
    this.name = 'BlockchainError';
    this.functionName = functionName; // Store the function context
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BlockchainError,
};

