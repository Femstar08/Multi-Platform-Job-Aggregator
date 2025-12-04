/**
 * Structured Logger Utility
 * Provides consistent logging across the application
 */

class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  _log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data
    };
    
    console.log(JSON.stringify(logEntry));
  }

  info(message, data = {}) {
    this._log('INFO', message, data);
  }

  warn(message, data = {}) {
    this._log('WARN', message, data);
  }

  error(message, error, data = {}) {
    this._log('ERROR', message, {
      error: error?.message,
      stack: error?.stack,
      ...data
    });
  }

  debug(message, data = {}) {
    this._log('DEBUG', message, data);
  }
}

module.exports = Logger;
