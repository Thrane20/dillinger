// Validation schemas for runner API requests
import { z } from 'zod';

// Resource Limits Schema
export const ResourceLimitsSchema = z.object({
  cpu: z.number().positive().max(16), // Max 16 CPU cores
  memory: z.string().regex(/^\d+[gG]$/), // e.g., "4g"
  gpuMemory: z.string().regex(/^\d+[gG]$/).optional()
});

// Display Configuration Schema
export const DisplayConfigurationSchema = z.object({
  width: z.number().int().min(640).max(7680), // 640x480 to 8K
  height: z.number().int().min(480).max(4320),
  depth: z.number().int().positive().default(24).optional(),
  refreshRate: z.number().int().positive().max(240).default(60).optional(),
  method: z.enum(['x11', 'wayland', 'headless'])
});

// Wine Configuration Schema
export const WineConfigurationSchema = z.object({
  version: z.string().min(1),
  prefix: z.string().optional(),
  dlls: z.record(z.string(), z.string()).optional()
});

// Launch Configuration Schema
export const LaunchConfigurationSchema = z.object({
  display: DisplayConfigurationSchema,
  resources: ResourceLimitsSchema,
  wine: WineConfigurationSchema.optional(),
  environment: z.record(z.string(), z.string()).optional()
});

// Game Launch Request Schema
export const GameLaunchRequestSchema = z.object({
  gameId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  configuration: LaunchConfigurationSchema.optional()
});

// Session Status Schema
export const SessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(['starting', 'running', 'paused', 'stopping', 'stopped', 'error']),
  containerId: z.string().optional(),
  streamUrl: z.string().url().optional(),
  startTime: z.string().datetime(),
  lastActivity: z.string().datetime().optional(),
  resources: z.object({
    cpu: z.number().min(0).max(100),
    memory: z.number().nonnegative(),
    gpuMemory: z.number().nonnegative().optional(),
    network: z.object({
      bytesIn: z.number().nonnegative(),
      bytesOut: z.number().nonnegative()
    })
  }).optional()
});

// Export type inference helpers
export type GameLaunchRequestInput = z.input<typeof GameLaunchRequestSchema>;
export type GameLaunchRequestOutput = z.output<typeof GameLaunchRequestSchema>;
export type LaunchConfigurationInput = z.input<typeof LaunchConfigurationSchema>;
export type LaunchConfigurationOutput = z.output<typeof LaunchConfigurationSchema>;