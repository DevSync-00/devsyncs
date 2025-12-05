/**
 * Technical debt tracking tests.
 * 
 * Tests for identifying and tracking technical debt in the codebase.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Technical debt tracker
 */
class TechnicalDebtTracker {
  private debtItems: Array<{
    file: string;
    line: number;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }> = [];

  /**
   * Scan file for technical debt indicators
   */
  scanFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Detect TODO, FIXME, HACK, XXX comments
      const todoMatch = line.match(/TODO|FIXME|HACK|XXX/i);
      if (todoMatch) {
        this.debtItems.push({
          file: filePath,
          line: index + 1,
          type: todoMatch[0].toUpperCase(),
          severity: this.determineSeverity(line),
          description: line.trim(),
        });
      }

      // Detect code smells
      if (this.detectCodeSmell(line)) {
        this.debtItems.push({
          file: filePath,
          line: index + 1,
          type: 'CODE_SMELL',
          severity: 'medium',
          description: line.trim(),
        });
      }
    });
  }

  /**
   * Determine severity from comment
   */
  private determineSeverity(line: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = line.toLowerCase();
    if (lower.includes('critical') || lower.includes('security')) {
      return 'critical';
    }
    if (lower.includes('high') || lower.includes('important')) {
      return 'high';
    }
    if (lower.includes('medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Detect code smells
   */
  private detectCodeSmell(line: string): boolean {
    // Detect common code smells
    const smells = [
      /any\s*[:=]/i, // any type usage
      /console\.(log|warn|error)/i, // console statements
      /eval\s*\(/i, // eval usage
      /@ts-ignore/i, // TypeScript ignore
      /eslint-disable/i, // ESLint disable
    ];

    return smells.some((pattern) => pattern.test(line));
  }

  /**
   * Get all debt items
   */
  getDebtItems(): typeof this.debtItems {
    return this.debtItems;
  }

  /**
   * Get debt summary
   */
  getSummary(): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    this.debtItems.forEach((item) => {
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
      byType[item.type] = (byType[item.type] || 0) + 1;
    });

    return {
      total: this.debtItems.length,
      bySeverity,
      byType,
    };
  }

  /**
   * Clear debt items
   */
  clear(): void {
    this.debtItems = [];
  }
}

suite('Technical Debt Tracking Tests', () => {
  let tracker: TechnicalDebtTracker;

  suite('Debt Detection', () => {
    test('should detect TODO comments', () => {
      tracker = new TechnicalDebtTracker();
      const testFile = path.join(__dirname, '../../test-debt.ts');
      
      // Create temporary test file
      fs.writeFileSync(testFile, '// TODO: Fix this\nfunction test() {}');
      
      tracker.scanFile(testFile);
      const items = tracker.getDebtItems();
      
      assert.ok(items.length > 0);
      assert.ok(items.some((item) => item.type === 'TODO'));
      
      // Cleanup
      fs.unlinkSync(testFile);
    });

    test('should detect FIXME comments', () => {
      tracker = new TechnicalDebtTracker();
      const testFile = path.join(__dirname, '../../test-debt.ts');
      
      fs.writeFileSync(testFile, '// FIXME: This needs fixing\nfunction test() {}');
      
      tracker.scanFile(testFile);
      const items = tracker.getDebtItems();
      
      assert.ok(items.some((item) => item.type === 'FIXME'));
      
      fs.unlinkSync(testFile);
    });

    test('should detect code smells', () => {
      tracker = new TechnicalDebtTracker();
      const testFile = path.join(__dirname, '../../test-debt.ts');
      
      fs.writeFileSync(testFile, 'const x: any = 5;\nconsole.log(x);');
      
      tracker.scanFile(testFile);
      const items = tracker.getDebtItems();
      
      assert.ok(items.some((item) => item.type === 'CODE_SMELL'));
      
      fs.unlinkSync(testFile);
    });
  });

  suite('Severity Classification', () => {
    test('should classify severity correctly', () => {
      tracker = new TechnicalDebtTracker();
      const testFile = path.join(__dirname, '../../test-debt.ts');
      
      fs.writeFileSync(testFile, '// TODO: Critical security issue\n// FIXME: High priority');
      
      tracker.scanFile(testFile);
      const items = tracker.getDebtItems();
      
      assert.ok(items.some((item) => item.severity === 'critical' || item.severity === 'high'));
      
      fs.unlinkSync(testFile);
    });
  });

  suite('Debt Summary', () => {
    test('should generate debt summary', () => {
      tracker = new TechnicalDebtTracker();
      const testFile = path.join(__dirname, '../../test-debt.ts');
      
      fs.writeFileSync(testFile, '// TODO: Test\n// FIXME: Test\nconst x: any = 5;');
      
      tracker.scanFile(testFile);
      const summary = tracker.getSummary();
      
      assert.ok(summary.total > 0);
      assert.ok(Object.keys(summary.bySeverity).length > 0);
      assert.ok(Object.keys(summary.byType).length > 0);
      
      fs.unlinkSync(testFile);
    });
  });
});

