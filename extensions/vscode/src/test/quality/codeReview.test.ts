/**
 * Automated code review tests.
 * 
 * Tests for automated code review rules and checks.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Code review checker
 */
class CodeReviewChecker {
  private issues: Array<{
    file: string;
    line: number;
    rule: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
  }> = [];

  /**
   * Review file for common issues
   */
  reviewFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for common issues
      this.checkLine(filePath, line, index + 1);
    });
  }

  /**
   * Check individual line for issues
   */
  private checkLine(filePath: string, line: string, lineNumber: number): void {
    // Check for hardcoded values
    if (this.hasHardcodedValues(line)) {
      this.issues.push({
        file: filePath,
        line: lineNumber,
        rule: 'no-hardcoded-values',
        severity: 'warning',
        message: 'Consider using constants or configuration for hardcoded values',
      });
    }

    // Check for magic numbers
    if (this.hasMagicNumbers(line)) {
      this.issues.push({
        file: filePath,
        line: lineNumber,
        rule: 'no-magic-numbers',
        severity: 'warning',
        message: 'Magic numbers should be replaced with named constants',
      });
    }

    // Check for long lines
    if (line.length > 120) {
      this.issues.push({
        file: filePath,
        line: lineNumber,
        rule: 'max-line-length',
        severity: 'info',
        message: `Line exceeds 120 characters (${line.length})`,
      });
    }

    // Check for missing error handling
    if (this.hasUnhandledAsync(line)) {
      this.issues.push({
        file: filePath,
        line: lineNumber,
        rule: 'require-error-handling',
        severity: 'warning',
        message: 'Async operations should have error handling',
      });
    }
  }

  /**
   * Check for hardcoded values
   */
  private hasHardcodedValues(line: string): boolean {
    // Simple check for common hardcoded patterns
    return /['"]https?:\/\/[^'"]+['"]/.test(line) || // URLs
      /['"][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}['"]/.test(line); // Emails
  }

  /**
   * Check for magic numbers
   */
  private hasMagicNumbers(line: string): boolean {
    // Check for standalone numbers (not in variable names or strings)
    return /\b\d{3,}\b/.test(line) && !line.includes('//') && !line.includes('*');
  }

  /**
   * Check for unhandled async
   */
  private hasUnhandledAsync(line: string): boolean {
    return /await\s+\w+\(/.test(line) && !line.includes('try') && !line.includes('catch');
  }

  /**
   * Get all issues
   */
  getIssues(): typeof this.issues {
    return this.issues;
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(severity: 'error' | 'warning' | 'info'): typeof this.issues {
    return this.issues.filter((issue) => issue.severity === severity);
  }

  /**
   * Clear issues
   */
  clear(): void {
    this.issues = [];
  }
}

suite('Automated Code Review Tests', () => {
  let checker: CodeReviewChecker;

  suite('Code Review Rules', () => {
    test('should detect hardcoded values', () => {
      checker = new CodeReviewChecker();
      const testFile = path.join(__dirname, '../../test-review.ts');
      
      fs.writeFileSync(testFile, 'const url = "https://api.example.com";');
      
      checker.reviewFile(testFile);
      const issues = checker.getIssues();
      
      assert.ok(issues.some((issue) => issue.rule === 'no-hardcoded-values'));
      
      fs.unlinkSync(testFile);
    });

    test('should detect magic numbers', () => {
      checker = new CodeReviewChecker();
      const testFile = path.join(__dirname, '../../test-review.ts');
      
      fs.writeFileSync(testFile, 'const timeout = 5000;');
      
      checker.reviewFile(testFile);
      const issues = checker.getIssues();
      
      assert.ok(issues.some((issue) => issue.rule === 'no-magic-numbers'));
      
      fs.unlinkSync(testFile);
    });

    test('should detect long lines', () => {
      checker = new CodeReviewChecker();
      const testFile = path.join(__dirname, '../../test-review.ts');
      
      const longLine = 'a'.repeat(150);
      fs.writeFileSync(testFile, longLine);
      
      checker.reviewFile(testFile);
      const issues = checker.getIssues();
      
      assert.ok(issues.some((issue) => issue.rule === 'max-line-length'));
      
      fs.unlinkSync(testFile);
    });
  });

  suite('Issue Filtering', () => {
    test('should filter issues by severity', () => {
      checker = new CodeReviewChecker();
      const testFile = path.join(__dirname, '../../test-review.ts');
      
      fs.writeFileSync(testFile, 'const url = "https://api.example.com";\nconst timeout = 5000;');
      
      checker.reviewFile(testFile);
      const warnings = checker.getIssuesBySeverity('warning');
      
      assert.ok(warnings.length > 0);
      
      fs.unlinkSync(testFile);
    });
  });
});

