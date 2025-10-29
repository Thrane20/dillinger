# Data Model: Dillinger Runner Streaming

**Feature**: 002-dillinger-runner-streaming  
**Date**: 2025-10-29  
**Status**: Draft

## Core Entities

### GameLaunchRequest

Represents a request to launch a game in the dillinger-runner container.

**Fields**:
- `gameId: string` - UUID of the game from dillinger library
- `userId: string` - ID of the user requesting the launch
- `platform: 'windows' | 'linux'` - Target platform for the game
- `launchConfig: LaunchConfiguration` - Container and runtime configuration
- `sessionId: string` - Unique identifier for this launch session
- `timestamp: Date` - When the launch was requested

**Relationships**:
- References existing Game entity in main dillinger library
- Creates RunnerSession entity when launched

**Validation Rules**:
- `gameId` must exist in dillinger_library volume
- `platform` must match game's supported platforms
- `sessionId` must be unique across active sessions

### LaunchConfiguration

Configuration parameters for container runtime and game execution.

**Fields**:
- `winePrefix?: string` - Custom Wine prefix path for Windows games
- `displayMode: 'x11' | 'wayland'` - Display forwarding method
- `resources: ResourceLimits` - CPU/memory/GPU constraints
- `environment: Record<string, string>` - Custom environment variables
- `volumes: VolumeMount[]` - Additional volume mounts beyond dillinger_library
- `audioEnabled: boolean` - Whether to enable audio forwarding

**Validation Rules**:
- `winePrefix` required when platform is 'windows'
- `displayMode` must be supported by host system
- `resources` must not exceed host capabilities

### ResourceLimits

Defines container resource constraints and GPU access.

**Fields**:
- `cpuLimit?: number` - CPU cores (e.g., 2.0 for 2 cores)
- `memoryLimit?: string` - Memory limit (e.g., "4G", "512M")
- `gpuAccess: 'none' | 'shared' | 'dedicated'` - GPU allocation strategy
- `gpuDevices?: string[]` - Specific GPU device IDs when dedicated
- `diskLimit?: string` - Temporary storage limit for container

**Validation Rules**:
- `cpuLimit` must be positive and <= host CPU count
- `memoryLimit` must be valid Docker memory format
- `gpuDevices` only valid when `gpuAccess` is 'dedicated'

### VolumeMount

Additional volume mounts beyond the default dillinger_library.

**Fields**:
- `hostPath: string` - Path on host system
- `containerPath: string` - Mount point in container
- `mode: 'ro' | 'rw'` - Read-only or read-write access
- `type: 'bind' | 'volume' | 'tmpfs'` - Mount type

**Validation Rules**:
- `hostPath` must exist and be accessible
- `containerPath` must not conflict with system paths
- Security: restrict to allowed host directories

### RunnerSession

Represents an active game session running in a dillinger-runner container.

**Fields**:
- `sessionId: string` - Unique session identifier
- `containerId: string` - Docker container ID
- `gameId: string` - Reference to launched game
- `userId: string` - User who launched the session
- `status: SessionStatus` - Current session state
- `startTime: Date` - When container was started
- `lastActivity?: Date` - Last input/output activity
- `displayInfo: DisplayConfiguration` - Display forwarding details
- `resourceUsage?: ResourceUsage` - Current resource consumption
- `processId?: number` - Game process ID within container

**Relationships**:
- References GameLaunchRequest that created it
- Contains DisplayConfiguration and ResourceUsage

**State Transitions**:
```
requested → starting → running → stopping → terminated
                   ↓
                crashed/failed
```

**Validation Rules**:
- `sessionId` must be unique across all sessions
- `containerId` must be valid Docker container ID
- `status` transitions must follow valid state machine

### SessionStatus

Enumeration of possible session states.

**Values**:
- `'requested'` - Launch request received, container not yet started
- `'starting'` - Container starting, game not yet launched
- `'running'` - Game actively running and responsive
- `'stopping'` - Graceful shutdown in progress
- `'terminated'` - Session ended successfully
- `'crashed'` - Game or container crashed unexpectedly
- `'failed'` - Failed to start due to error

### DisplayConfiguration

Configuration for display forwarding from container to host.

**Fields**:
- `method: 'x11' | 'wayland'` - Display forwarding protocol
- `displayId: string` - X11 DISPLAY value or Wayland display name
- `resolution?: string` - Requested resolution (e.g., "1920x1080")
- `refreshRate?: number` - Requested refresh rate in Hz
- `socketPath?: string` - Path to display socket on host
- `authToken?: string` - X11 authentication token

**Validation Rules**:
- `displayId` must be valid format for chosen method
- `resolution` must be supported by display system
- `socketPath` must be accessible from container

### ResourceUsage

Current resource consumption metrics for a running session.

**Fields**:
- `cpuPercent: number` - CPU usage percentage (0-100)
- `memoryUsed: number` - Memory usage in bytes
- `memoryPercent: number` - Memory usage percentage of limit
- `gpuUsage?: number` - GPU utilization percentage (0-100)
- `gpuMemoryUsed?: number` - GPU memory usage in bytes
- `diskUsage: number` - Temporary disk usage in bytes
- `timestamp: Date` - When metrics were collected

**Validation Rules**:
- All percentage values must be between 0 and 100
- Memory and disk usage must be non-negative
- `timestamp` must be recent (within last few minutes)

## Indexes and Queries

### Primary Indexes
- `RunnerSession.sessionId` - Fast session lookup
- `RunnerSession.userId` - User's active sessions
- `RunnerSession.status` - Sessions by state
- `GameLaunchRequest.gameId` - Launch history for games

### Common Queries
- Active sessions for user: `RunnerSession.userId + status='running'`
- Resource usage monitoring: `RunnerSession.status='running'` → `ResourceUsage`
- Session cleanup: `RunnerSession.status IN ['terminated', 'crashed', 'failed']`
- Container health check: `RunnerSession.containerId` → Docker API status

## Storage Implementation

### File Structure
```
/data/runner-sessions/
├── active/
│   └── {sessionId}.json          # Active session metadata
├── history/
│   └── {date}/
│       └── {sessionId}.json      # Completed session records
└── metrics/
    └── {sessionId}/
        └── {timestamp}.json      # Resource usage samples
```

### JSON Schema Examples

**RunnerSession Example**:
```json
{
  "sessionId": "sess_7f9e2b4a-1234-5678-9abc-def012345678",
  "containerId": "dillinger_runner_sess_7f9e2b4a",
  "gameId": "game_diablo_pc_12345",
  "userId": "user_john_doe",
  "status": "running",
  "startTime": "2025-10-29T14:30:00Z",
  "lastActivity": "2025-10-29T14:45:32Z",
  "displayInfo": {
    "method": "x11",
    "displayId": ":1",
    "resolution": "1920x1080",
    "socketPath": "/tmp/.X11-unix/X1"
  },
  "resourceUsage": {
    "cpuPercent": 45.2,
    "memoryUsed": 2147483648,
    "memoryPercent": 53.7,
    "gpuUsage": 78.9,
    "timestamp": "2025-10-29T14:45:30Z"
  },
  "processId": 1234
}
```

**GameLaunchRequest Example**:
```json
{
  "gameId": "game_diablo_pc_12345",
  "userId": "user_john_doe",
  "platform": "windows",
  "sessionId": "sess_7f9e2b4a-1234-5678-9abc-def012345678",
  "timestamp": "2025-10-29T14:29:45Z",
  "launchConfig": {
    "winePrefix": "/home/retro/.wine-diablo",
    "displayMode": "x11",
    "audioEnabled": true,
    "resources": {
      "cpuLimit": 4.0,
      "memoryLimit": "4G",
      "gpuAccess": "shared"
    },
    "environment": {
      "WINEDLLOVERRIDES": "d3d11=n;dxgi=n",
      "DXVK_HUD": "fps"
    }
  }
}
```