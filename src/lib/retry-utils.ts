import { toast } from "sonner"

interface RetryConfig {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryableErrors?: Array<string | RegExp>
  onRetry?: (error: Error, attempt: number) => void
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryableErrors: [
    'Failed to fetch',
    'Network request failed',
    'timeout',
    /5\d\d/, // 5XX server errors
    'ECONNRESET',
    'ETIMEDOUT'
  ],
  onRetry: (error, attempt) => {
    toast.error(`Operation failed. Retrying... (${attempt})`, {
      description: error.message
    })
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config }
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (caughtError) {
      const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError))
      lastError = error
      
      // Check if error is retryable
      const isRetryable = finalConfig.retryableErrors.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(error.message)
        }
        return error.message.toLowerCase().includes(pattern.toLowerCase())
      })
      
      // If error is not retryable or this was the last attempt, throw
      if (!isRetryable || attempt === finalConfig.maxAttempts) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffFactor, attempt - 1),
        finalConfig.maxDelay
      )
      
      // Notify about retry
      finalConfig.onRetry(error, attempt)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // This should never happen due to the throw above, but TypeScript needs it
  throw lastError
}

export function createRetryableFunction<T>(
  operation: () => Promise<T>,
  config?: RetryConfig
) {
  let isRetrying = false
  let retryCount = 0
  
  const retry = async (): Promise<T> => {
    isRetrying = true
    retryCount++
    
    try {
      const result = await withRetry(operation, {
        ...config,
        onRetry: (error, attempt) => {
          config?.onRetry?.(error, attempt)
          retryCount = attempt
        }
      })
      isRetrying = false
      retryCount = 0
      return result
    } catch (error) {
      isRetrying = false
      throw error
    }
  }
  
  return {
    execute: retry,
    isRetrying: () => isRetrying,
    retryCount: () => retryCount,
    reset: () => {
      isRetrying = false
      retryCount = 0
    }
  }
} 