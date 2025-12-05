# Security Enhancements

This module provides comprehensive security features for the DevSync VS Code extension.

## Features

### 1. Encryption Service

Encrypts sensitive data at rest using AES-256-GCM encryption.

```typescript
import { createEncryptionService } from './security';

const encryption = await createEncryptionService(context);

// Encrypt sensitive data
const encrypted = await encryption.encrypt('sensitive-connection-string');
await context.secrets.store('db.connection', encrypted);

// Decrypt data
const encrypted = await context.secrets.get('db.connection');
if (encrypted) {
  const decrypted = await encryption.decrypt(encrypted);
}
```

### 2. Token Rotation

Automatic token rotation for enhanced security.

```typescript
import { TokenRotationManager } from './security';

const rotationManager = new TokenRotationManager(authManager, {
  maxAccessTokenAge: 60 * 60 * 1000, // 1 hour
  maxRefreshTokenAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  checkInterval: 5 * 60 * 1000, // 5 minutes
  enabled: true,
});

rotationManager.start();

// Listen for rotation events
rotationManager.onTokenRotation((event) => {
  console.log('Token rotated:', event);
});
```

### 3. Session Timeout Warnings

Monitors session expiration and provides warnings.

```typescript
import { SessionTimeoutManager } from './security';

const timeoutManager = new SessionTimeoutManager(authManager, {
  warningIntervals: [
    15 * 60 * 1000, // 15 minutes
    5 * 60 * 1000,  // 5 minutes
    1 * 60 * 1000,  // 1 minute
  ],
  enabled: true,
  checkInterval: 60 * 1000, // 1 minute
});

timeoutManager.start();

// Listen for warnings
timeoutManager.onTimeoutWarning((warning) => {
  console.log('Session warning:', warning);
});
```

### 4. Multi-Factor Authentication

MFA support infrastructure.

```typescript
import { MfaManager } from './security';

const mfaManager = new MfaManager(context, apiClient);

// Check MFA status
const status = await mfaManager.getMfaStatus();

// Start MFA setup
const challenge = await mfaManager.startMfaSetup('totp');

// Complete setup
const result = await mfaManager.completeMfaSetup(challenge.challengeId, '123456');
```

### 5. Audit Logging

Comprehensive audit logging for security events.

```typescript
import { AuditLogger } from './security';

const auditLogger = new AuditLogger(context);

// Log events
await auditLogger.log('auth.login', 'User logged in', 'success', {
  severity: 'info',
  details: { method: 'device_flow' },
});

// Query logs
const logs = await auditLogger.query({
  type: 'auth.login',
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
});
```

### 6. Permission Scoping

Role-based access control (RBAC).

```typescript
import { PermissionManager, DEFAULT_ROLES } from './security';

const permissionManager = new PermissionManager(context, userId);

// Set user role
await permissionManager.setRole(userId, 'developer');

// Check permission
const result = permissionManager.hasPermission('scan', 'execute');
if (result.allowed) {
  // Perform scan
}

// Require permission (throws if not allowed)
permissionManager.requirePermission('migrate', 'execute');
```

### 7. Credential Storage

Secure storage for sensitive credentials.

```typescript
import { CredentialStorage } from './security';

const credentialStorage = new CredentialStorage(context, encryptionService);

// Store connection string securely
await credentialStorage.storeConnectionString('postgresql://user:pass@host/db');

// Retrieve connection string
const connectionString = await credentialStorage.getConnectionString();
```

### 8. Log Sanitization

Automatically removes sensitive information from logs.

```typescript
import { LogSanitizer } from './security';

const sanitizer = new LogSanitizer({
  maskEmails: false,
  maskIpAddresses: false,
});

// Sanitize log message
const safe = sanitizer.sanitize('Connecting to postgresql://user:pass@host/db');
// Returns: 'Connecting to [CONNECTION_STRING]'

// Sanitize error
const safeError = sanitizer.sanitizeError(error);
```

### 9. Data Masking

Masks sensitive data in UI displays.

```typescript
import { DataMasking } from './security';

const masking = new DataMasking();

// Mask API key
const masked = masking.maskApiKey('sk-1234567890abcdef');
// Returns: 'sk-1234********cdef'

// Mask connection string
const maskedConn = masking.maskConnectionString('postgresql://user:pass@host/db');
// Returns: 'postgresql://u***:p***@h***/db'
```

### 10. TLS Verification

Verifies TLS connections and certificates.

```typescript
import { TlsVerification } from './security';

const verifier = new TlsVerification();

// Verify TLS connection
const result = await verifier.verify('https://api.example.com');
if (!result.valid) {
  console.error('TLS verification failed:', result.error);
}

// Create secure HTTPS agent
const agent = verifier.createSecureAgent({
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});
```

### 11. Data Protection Manager

Integrated data protection manager that combines all features.

```typescript
import { createDataProtectionManager } from './security';

const dataProtection = await createDataProtectionManager(context, encryptionService);

// Store connection string (automatically encrypted and verified)
await dataProtection.storeConnectionString('postgresql://user:pass@host/db');

// Get connection string (optionally masked)
const masked = await dataProtection.getConnectionString(true);

// Verify TLS before requests
const isValid = await dataProtection.verifyTls('https://api.example.com');
```

## Integration

### With Authentication

```typescript
import { TokenRotationManager, SessionTimeoutManager, AuditLogger } from './security';

// Initialize security components
const auditLogger = new AuditLogger(context);
const rotationManager = new TokenRotationManager(authManager);
const timeoutManager = new SessionTimeoutManager(authManager);

// Start monitoring
rotationManager.start();
timeoutManager.start();

// Log authentication events
authManager.onDidChangeSession(async (session) => {
  if (session.status === 'authenticated') {
    await auditLogger.log('auth.login', 'User logged in', 'success');
    auditLogger.setUserId(session.userId || 'unknown');
  } else if (session.status === 'unauthenticated') {
    await auditLogger.log('auth.logout', 'User logged out', 'success');
  }
});
```

### With Configuration

```typescript
import { EncryptionService, CredentialStorage } from './security';

const encryption = await createEncryptionService(context);
const credentialStorage = new CredentialStorage(context, encryption);

// Encrypt sensitive config values
await credentialStorage.storeConnectionString(databaseConnection);

// Decrypt when needed
const connectionString = await credentialStorage.getConnectionString();
```

### With Logging

Log sanitization is automatically enabled when using DataProtectionManager:

```typescript
import { createDataProtectionManager } from './security';

const dataProtection = await createDataProtectionManager(context);

// All console.log, console.error, etc. are automatically sanitized
console.log('Connection string:', 'postgresql://user:pass@host/db');
// Output: 'Connection string: [CONNECTION_STRING]'
```

## Security Best Practices

1. **Always encrypt sensitive data** before storing in VS Code secrets
2. **Enable token rotation** for production environments
3. **Monitor audit logs** regularly for suspicious activity
4. **Use permission scoping** to limit access based on roles
5. **Enable MFA** for sensitive operations
6. **Clear old audit logs** periodically to manage storage
7. **Use credential storage** for all sensitive data
8. **Sanitize all logs** to prevent credential leakage
9. **Mask sensitive data** in UI displays
10. **Verify TLS** for all external connections

### 12. Input Validation

Comprehensive input validation and sanitization.

```typescript
import { InputValidator, SqlSanitization, RateLimiter, TypeValidator } from './security';

// Validate user input
const result = InputValidator.validateString(userInput, {
  maxLength: 100,
  minLength: 1,
  blockedPatterns: InputValidator.getSqlInjectionPatterns(),
});

// Create parameterized SQL query
const query = SqlSanitization.parameterize(
  'SELECT * FROM users WHERE id = ? AND name = ?',
  [userId, userName]
);

// Rate limiting
const rateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
});

const allowed = rateLimiter.check(userId);

// Type validation
const validation = TypeValidator.validateString(value);
```

## Configuration

Security features can be configured through VS Code settings:

```json
{
  "devsync.security.encryption.enabled": true,
  "devsync.security.tokenRotation.enabled": true,
  "devsync.security.tokenRotation.maxAccessTokenAge": 3600000,
  "devsync.security.sessionTimeout.enabled": true,
  "devsync.security.sessionTimeout.warningIntervals": [900000, 300000, 60000],
  "devsync.security.auditLog.enabled": true,
  "devsync.security.auditLog.retentionDays": 90,
  "devsync.security.logSanitization.enabled": true,
  "devsync.security.dataMasking.enabled": true,
  "devsync.security.tlsVerification.enabled": true
}
```
