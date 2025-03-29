// Performance metrics
export interface PerformanceMetrics {
  responseTime: number;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  requestRate?: {
    current: number;
    average: number;
  };
  api?: {
    status: 'good' | 'warning' | 'critical';
    averageResponseTime: number;
    successRate: number;
    thresholds: {
      good: number;
      warning: number;
      critical: number;
    };
    endpoints: Array<{
      endpoint: string;
      averageResponseTime: number;
      lastResponseTime: number;
      status: 'good' | 'warning' | 'critical';
      recentRequests: number;
      successRate: number;
    }>;
  };
}

// Basic health check response
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  environment: string;
  ready: boolean;
  version: string;
  services: {
    auth: boolean;
    db: boolean;
    env: boolean;
    llm: string;
  };
  performance: {
    responseTime: number;
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    requestRate: {
      current: number;
      average: number;
    };
    api?: {
      status: 'good' | 'warning' | 'critical';
      averageResponseTime: number;
      successRate: number;
      thresholds: {
        warning: number;
        critical: number;
      };
      endpoints: Array<{
        endpoint: string;
        averageResponseTime: number;
        lastResponseTime: number;
        status: 'good' | 'warning' | 'critical';
        recentRequests: number;
        successRate: number;
      }>;
    };
  };
}

// System status indicators
export interface SystemStatus {
  auth: boolean;
  db: boolean;
  env: boolean;
}

// LLM provider information
export interface LLMProviderInfo {
  type: string;
  capabilities?: {
    name: string;
    version: string;
    maxTokens: number;
    supportsJson: boolean;
    temperature: number;
    maxDuration: number;
  };
}

// LLM system status
export interface LLMSystemInfo {
  activeProvider: LLMProviderInfo | null;
  availableProviders: string[];
}

// Full system information response
export interface SystemInfoResponse {
  version: string;
  branch: string;
  environment: string;
  status: SystemStatus;
  auth: {
    isAuthenticated: boolean;
    user: string | null;
  };
  llm: LLMSystemInfo;
}

// Error response
export interface SystemErrorResponse {
  error: string;
  details?: unknown;
} 