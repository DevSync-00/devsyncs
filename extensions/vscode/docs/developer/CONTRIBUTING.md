# Contribution Guidelines

How to contribute to DevSync.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Pull Request Process](#pull-request-process)
5. [Issue Reporting](#issue-reporting)
6. [Testing Requirements](#testing-requirements)
7. [Code Review](#code-review)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what's best for the project

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Any other unprofessional conduct

## Getting Started

### 1. Fork the Repository

1. Go to [GitHub Repository](https://github.com/devsync/devsync)
2. Click "Fork"
3. Clone your fork:
   ```bash
   git clone https://github.com/your-username/devsync.git
   cd devsync/extensions/vscode
   ```

### 2. Set Up Development Environment

Follow the [Development Setup Guide](DEVELOPMENT_SETUP.md).

### 3. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

**Branch Naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Refactoring
- `test/` - Tests

## Development Process

### 1. Make Changes

- Write clean, readable code
- Follow [Code Style Guide](CODE_STYLE.md)
- Add tests for new features
- Update documentation

### 2. Test Your Changes

```bash
# Run tests
npm test

# Run linting
npm run lint

# Check formatting
npm run format:check

# Run all quality checks
npm run quality
```

### 3. Commit Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update documentation"
```

**Commit Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting)
- `refactor:` - Refactoring
- `test:` - Tests
- `chore:` - Maintenance

### 4. Keep Branch Updated

```bash
# Fetch latest changes
git fetch upstream

# Rebase on main
git rebase upstream/main
```

## Pull Request Process

### 1. Create Pull Request

1. Push your branch:
   ```bash
   git push origin feature/my-feature
   ```

2. Create PR on GitHub:
   - Go to repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out PR template

### 2. PR Requirements

**Required**:
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No linting errors
- [ ] All tests pass
- [ ] PR description filled out

**PR Description Template**:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
```

### 3. Review Process

1. **Automated Checks**:
   - CI/CD runs tests
   - Linting checks
   - Type checking

2. **Code Review**:
   - Maintainers review code
   - Address feedback
   - Make requested changes

3. **Approval**:
   - At least one approval required
   - All checks must pass
   - No merge conflicts

### 4. Merge

- Squash and merge (preferred)
- Or merge commit
- Delete branch after merge

## Issue Reporting

### Before Reporting

1. **Search Existing Issues**: Check if issue already exists
2. **Check Documentation**: Verify it's not documented
3. **Reproduce**: Ensure you can reproduce the issue

### Issue Template

```markdown
## Description
Clear description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 10]
- VS Code Version: [e.g., 1.80.0]
- Extension Version: [e.g., 1.0.0]
- Node Version: [e.g., 18.0.0]

## Additional Context
Any other relevant information
```

### Bug Reports

**Include**:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages/logs
- Screenshots (if applicable)

### Feature Requests

**Include**:
- Use case description
- Proposed solution
- Alternatives considered
- Impact assessment

## Testing Requirements

### Unit Tests

- Test all new functions
- Mock external dependencies
- Aim for >80% coverage

**Example**:
```typescript
suite('ScanService', () => {
  test('should scan schema successfully', async () => {
    const service = new ScanService(mockApiClient, mockCliRunner);
    const result = await service.scanSchema({ schema: '...' });
    assert.ok(result);
  });
});
```

### Integration Tests

- Test component interactions
- Use real dependencies where possible
- Test error scenarios

### UI Tests

- Test user interactions
- Test visual elements
- Test accessibility

### Test Coverage

- Minimum: 80% coverage
- Critical paths: 100% coverage
- New features: Must have tests

## Code Review

### Review Checklist

**Functionality**:
- [ ] Code works as intended
- [ ] Edge cases handled
- [ ] Error handling present
- [ ] Performance considered

**Code Quality**:
- [ ] Follows style guide
- [ ] No code smells
- [ ] Well documented
- [ ] No duplication

**Testing**:
- [ ] Tests added
- [ ] Tests pass
- [ ] Coverage adequate
- [ ] Edge cases tested

**Documentation**:
- [ ] Code documented
- [ ] README updated
- [ ] API docs updated
- [ ] Examples provided

### Review Comments

**Be Constructive**:
- Explain why, not just what
- Suggest improvements
- Ask questions
- Be respectful

**Respond to Feedback**:
- Address all comments
- Ask for clarification
- Discuss alternatives
- Update code accordingly

## Documentation

### Code Documentation

- JSDoc for all public APIs
- Inline comments for complex logic
- README for new features
- Examples in code

### API Documentation

- Document interfaces
- Document types
- Provide examples
- Update TypeDoc

## Release Process

### Versioning

Follow [Semantic Versioning](https://semver.org/):
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Changelog

Update `CHANGELOG.md`:
- List all changes
- Group by type
- Include migration notes
- Link to issues/PRs

## Getting Help

### Questions?

- **GitHub Discussions**: Ask questions
- **GitHub Issues**: Report problems
- **Documentation**: Check docs first
- **Code Review**: Ask in PR comments

### Resources

- [Development Setup](DEVELOPMENT_SETUP.md)
- [Code Style Guide](CODE_STYLE.md)
- [Architecture Overview](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)

---

**Thank you for contributing to DevSync!** 🎉

