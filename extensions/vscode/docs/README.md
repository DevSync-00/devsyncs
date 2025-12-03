# DevSync Extension API Documentation

This directory contains automatically generated API documentation for the DevSync VS Code extension.

## Generating Documentation

To generate the API documentation, run:

```bash
npm run docs
```

This will create HTML documentation in the `docs/api` directory.

## Documentation Structure

The documentation is organized by:

- **Core** - Main extension entry points and activation
- **Interfaces** - Public interfaces and contracts
- **Classes** - Implementation classes
- **Functions** - Utility and helper functions
- **Types** - Type definitions and schemas
- **Utilities** - Shared utility modules
- **Configuration** - Configuration management
- **State Management** - State store and actions
- **Error Handling** - Error classes and recovery

## Viewing Documentation

Open `docs/api/index.html` in a web browser to view the documentation.

## Documentation Standards

All public APIs should include:

- **Description** - What the API does
- **Parameters** - `@param` tags for all parameters
- **Returns** - `@returns` tag describing the return value
- **Throws** - `@throws` tags for possible exceptions
- **Examples** - `@example` blocks showing usage

## Updating Documentation

Documentation is automatically generated from JSDoc comments in the source code.
To update documentation:

1. Add or update JSDoc comments in the source files
2. Run `npm run docs` to regenerate
3. Commit both source changes and generated documentation

