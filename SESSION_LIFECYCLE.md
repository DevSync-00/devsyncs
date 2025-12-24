# Session Lifecycle Management

## Overview

DevSync uses **lifecycle-based session management** instead of time-based expiration. Sessions remain active indefinitely while the user is working and only terminate on explicit logout or when the application window/process closes.

## Session Lifecycle Rules

### Session Start
- **CLI**: Session starts when `devsync login` completes successfully
- **VS Code Extension**: Session starts when user completes sign-in flow

### Session Continuation
- Sessions remain active **indefinitely** while the user is working
- Access tokens are automatically refreshed before expiration
- Refresh tokens are used to obtain new access tokens
- Network interruptions do not invalidate sessions (retry on next operation)

### Session Termination
Sessions only end when:

1. **Explicit Logout**
   - CLI: Not applicable (process exits on logout)
   - VS Code: User clicks "Sign Out" or runs `devsync.chat.logout` command

2. **Window/Process Close**
   - CLI: Terminal process exits
   - VS Code: Workspace window is closed

3. **Refresh Token Invalid**
   - Only if refresh token itself is invalid/expired (not network errors)
   - User must re-authenticate

### Session Persistence

- **VS Code Reloads**: Sessions persist across `Developer: Reload Window`
  - Tokens are stored in VS Code's secure storage
  - Tokens are restored on extension activation
  - If tokens are expired, they are automatically refreshed

- **OS Sleep/Wake**: Sessions remain active
  - No time-based expiration
  - Token refresh retries on next operation if needed

- **Network Interruptions**: Sessions remain active
  - Network errors don't invalidate sessions
  - Token refresh retries on next operation

## Implementation Details

### VS Code Extension

**File**: `extensions/vscode/src/auth.ts`

- `restoreTokens()`: Restores session on extension activation
- `ensureAccessToken()`: Automatically refreshes tokens before expiration
- `logout()`: Explicitly terminates session and clears tokens

**File**: `extensions/vscode/src/security/sessionTimeout.ts`

- Renamed from "Session Timeout Manager" to "Session Lifecycle Manager"
- No longer expires sessions based on time
- Only monitors token refresh needs
- Only shows errors if refresh token is invalid

**File**: `extensions/vscode/src/extension.ts`

- `deactivate()`: Called on window close or extension disable
- Tokens are preserved in secure storage (not cleared)
- Sessions persist across reloads

### CLI Tool

**File**: `packages/cli/src/lib/auth-check.ts`

- `requireAuthenticatedCli()`: Ensures valid authentication
- Automatically refreshes expired access tokens
- Only exits if refresh token is invalid (not on network errors)
- Sessions remain active for the lifetime of the CLI process

**File**: `packages/cli/src/lib/auth-config.ts`

- `isTokenExpired()`: Checks if token needs refresh
- Tokens are stored in `~/.config/devsync/config.json`
- Tokens persist across CLI invocations

## Edge Cases Handled

### VS Code Reloads
- ✅ Sessions persist - tokens are restored from secure storage
- ✅ Expired tokens are automatically refreshed on activation
- ✅ Network errors during refresh don't invalidate session

### OS Sleep/Wake
- ✅ Sessions remain active - no time-based expiration
- ✅ Token refresh retries on next operation if needed

### Network Interruptions
- ✅ Sessions remain active during network issues
- ✅ Token refresh retries on next operation
- ✅ Only invalid refresh tokens cause session termination

### Explicit Logout
- ✅ Immediately clears tokens from memory and storage
- ✅ Session state updated to 'unauthenticated'
- ✅ User must log in again to continue

## Configuration

No configuration needed - lifecycle-based sessions are the default behavior.

The `SessionTimeoutManager` is still present for backward compatibility but:
- Does not expire sessions based on time
- Only monitors token refresh needs
- Only shows errors for invalid refresh tokens

## Migration Notes

If you had code relying on time-based session expiration:
- Remove any checks for `session.expiresAt` time remaining
- Sessions don't expire - they only end on logout or window close
- Token refresh is automatic and transparent
