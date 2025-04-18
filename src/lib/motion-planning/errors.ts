/**
 * Base error class for all motion planning related issues.
 */
export class MotionPlannerError extends Error {
  public readonly context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.name = 'MotionPlannerError';
    this.context = context;
    // Ensure the prototype chain is correct
    Object.setPrototypeOf(this, MotionPlannerError.prototype);
  }
}

/**
 * Error during interaction with the underlying AI Assistant/Provider.
 */
export class AssistantInteractionError extends MotionPlannerError {
  public readonly providerStatusCode?: number | string; // e.g., HTTP status or specific code

  constructor(message: string, providerStatusCode?: number | string, context?: unknown) {
    super(message, context);
    this.name = 'AssistantInteractionError';
    this.providerStatusCode = providerStatusCode;
    Object.setPrototypeOf(this, AssistantInteractionError.prototype);
  }
}

/**
 * Error when parsing or validating the MotionPlan structure received from the assistant.
 */
export class MotionPlanParsingError extends MotionPlannerError {
  constructor(message: string, context?: unknown) {
    super(message, context);
    this.name = 'MotionPlanParsingError';
    Object.setPrototypeOf(this, MotionPlanParsingError.prototype);
  }
}

/**
 * Error related to invalid configuration for the motion planner or provider.
 */
export class ConfigurationError extends MotionPlannerError {
  constructor(message: string, context?: unknown) {
    super(message, context);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

// You can add more specific error types as needed 