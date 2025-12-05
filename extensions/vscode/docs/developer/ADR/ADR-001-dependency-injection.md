# ADR-001: Dependency Injection

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: DevSync Team

## Context

The extension was growing in complexity with tightly coupled components. Testing was difficult because components couldn't be easily mocked or replaced. We needed a way to manage dependencies and improve testability.

## Decision

We will implement a Dependency Injection (DI) container pattern using a custom container implementation. All major components will be registered in the container and resolved through interfaces.

## Implementation

- Created `DIContainer` class for service registration and resolution
- Defined interfaces for all major components (`IApiClient`, `ICliRunner`, etc.)
- Implemented factory pattern for container creation
- All services registered at extension activation

## Consequences

### Positive

- **Testability**: Components can be easily mocked for testing
- **Flexibility**: Components can be swapped without changing dependent code
- **Maintainability**: Clear dependency graph
- **Extensibility**: Easy to add new implementations

### Negative

- **Initial Complexity**: More setup required initially
- **Learning Curve**: Team needs to understand DI pattern
- **Runtime Errors**: Missing registrations only discovered at runtime

## Alternatives Considered

1. **Manual Dependency Passing**: Too verbose and error-prone
2. **Service Locator Pattern**: Considered anti-pattern
3. **Third-party DI Library**: Added unnecessary dependency

## References

- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)
- Implementation: `src/di/container.ts`
- Factory: `src/di/factory.ts`

