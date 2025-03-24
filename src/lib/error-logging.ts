import { toast } from 'sonner';

interface ErrorDetails {
  message: string;
  componentStack?: string;
  error?: Error;
  context?: Record<string, any>;
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorCount: Map<string, number> = new Map();
  private readonly MAX_ERRORS = 3; // Maximum number of same errors to log
  private readonly ERROR_RESET_TIME = 1000 * 60 * 5; // 5 minutes

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  logError({ message, componentStack, error, context }: ErrorDetails) {
    // Create a unique key for this error
    const errorKey = `${message}-${componentStack || ''}`;
    
    // Check if we've seen this error too many times
    const errorCount = this.errorCount.get(errorKey) || 0;
    if (errorCount >= this.MAX_ERRORS) {
      return;
    }

    // Increment error count
    this.errorCount.set(errorKey, errorCount + 1);

    // Reset error count after timeout
    setTimeout(() => {
      this.errorCount.delete(errorKey);
    }, this.ERROR_RESET_TIME);

    // Log to console with full details
    console.error('Application Error:', {
      message,
      componentStack,
      error,
      context,
      timestamp: new Date().toISOString()
    });

    // Show user-friendly toast
    toast.error('An error occurred', {
      description: this.getUserFriendlyMessage(message),
      duration: 5000,
    });

    // Here you could add additional error reporting services
    // e.g., Sentry, LogRocket, etc.
  }

  private getUserFriendlyMessage(technicalMessage: string): string {
    // Map technical errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'Failed to fetch': 'Connection error. Please check your internet connection.',
      'WebGL not supported': 'Your browser does not support 3D graphics. Please try a different browser.',
      'Out of memory': 'The model is too large to load. Please try a smaller model.',
      // Add more mappings as needed
    };

    // Find a matching user-friendly message or return a generic one
    for (const [technical, friendly] of Object.entries(errorMap)) {
      if (technicalMessage.includes(technical)) {
        return friendly;
      }
    }

    return 'Something went wrong. Please try again.';
  }

  clearErrors() {
    this.errorCount.clear();
  }
}

export const errorLogger = ErrorLogger.getInstance();

// Helper function for components
export function logError(error: Error, componentName: string, context?: Record<string, any>) {
  errorLogger.logError({
    message: error.message,
    error,
    context: {
      componentName,
      ...context
    }
  });
}

// Custom error types
export class ViewerError extends Error {
  constructor(message: string, public context?: Record<string, any>) {
    super(message);
    this.name = 'ViewerError';
  }
}

export class ModelError extends Error {
  constructor(message: string, public modelUrl?: string) {
    super(message);
    this.name = 'ModelError';
  }
}

export class CameraError extends Error {
  constructor(message: string, public cameraState?: Record<string, any>) {
    super(message);
    this.name = 'CameraError';
  }
} 