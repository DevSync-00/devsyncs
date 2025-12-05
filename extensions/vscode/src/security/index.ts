/**
 * Security enhancements module.
 * 
 * Provides comprehensive security features including:
 * - Encryption for sensitive data at rest
 * - Token rotation
 * - Session timeout warnings
 * - Multi-factor authentication support
 * - Audit logging
 * - Permission scoping and RBAC
 */

export {
  EncryptionService,
  createEncryptionService,
} from './encryption';

export {
  TokenRotationManager,
  TokenRotationConfig,
  TokenRotationEvent,
} from './tokenRotation';

export {
  SessionTimeoutManager,
  SessionTimeoutConfig,
  SessionTimeoutWarning,
} from './sessionTimeout';

export {
  MfaManager,
  IMfaManager,
  MfaMethod,
  MfaStatus,
  MfaChallenge,
  MfaVerificationResult,
} from './mfa';

export {
  AuditLogger,
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
  AuditLogQuery,
  IAuditLogStorage,
} from './auditLog';

export {
  PermissionManager,
  PermissionError,
  RequirePermission,
  Permission,
  PermissionScope,
  UserRole,
  Role,
  DEFAULT_ROLES,
  PermissionCheckResult,
} from './permissions';

export {
  SecurityManager,
  createSecurityManager,
} from './integration';

export {
  CredentialStorage,
} from './credentialStorage';

export {
  LogSanitizer,
  defaultLogSanitizer,
  LogSanitizerOptions,
} from './logSanitizer';

export {
  DataMasking,
  defaultDataMasking,
  MaskingOptions,
} from './dataMasking';

export {
  TlsVerification,
  defaultTlsVerification,
  TlsVerificationOptions,
  TlsVerificationResult,
} from './tlsVerification';

export {
  DataProtectionManager,
  createDataProtectionManager,
} from './dataProtection';

export {
  InputValidator,
  ValidationResult,
  ValidationOptions,
} from './inputValidation';

export {
  SqlSanitization,
  ParameterizedQuery,
  SqlParameter,
} from './sqlSanitization';

export {
  RateLimiter,
  createRateLimiter,
  RateLimitConfig,
  RateLimitResult,
} from './rateLimiting';

export {
  TypeValidator,
  TypeValidationResult,
} from './typeValidation';

export {
  InputValidationManager,
  createInputValidationManager,
  InputValidationManagerConfig,
} from './inputValidationManager';

export {
  showValidatedInputBox,
  showValidatedQuickPick,
  validateUserInput,
  validateConfigInput,
} from './inputHelpers';

