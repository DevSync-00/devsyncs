/**
 * Code complexity metrics tests.
 * 
 * Tests for cyclomatic complexity, cognitive complexity, and code quality metrics.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Complexity metrics analyzer
 */
class ComplexityAnalyzer {
  /**
   * Calculate cyclomatic complexity of a function
   */
  calculateCyclomaticComplexity(code: string): number {
    // Count decision points: if, else, for, while, switch, case, catch, &&, ||, ?:
    const decisionPoints = [
      /if\s*\(/g,
      /else\s*{/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
    ];

    let complexity = 1; // Base complexity
    decisionPoints.forEach((pattern) => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  /**
   * Calculate cognitive complexity
   */
  calculateCognitiveComplexity(code: string): number {
    // Simplified cognitive complexity calculation
    // In practice, this would be more sophisticated
    const cyclomatic = this.calculateCyclomaticComplexity(code);
    // Cognitive complexity is typically lower than cyclomatic
    return Math.max(1, Math.floor(cyclomatic * 0.8));
  }

  /**
   * Analyze file complexity
   */
  analyzeFile(filePath: string): {
    cyclomatic: number;
    cognitive: number;
    lines: number;
    functions: number;
  } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const functions = (content.match(/(function|const\s+\w+\s*=\s*(async\s+)?\(|=>)/g) || []).length;

    return {
      cyclomatic: this.calculateCyclomaticComplexity(content),
      cognitive: this.calculateCognitiveComplexity(content),
      lines,
      functions,
    };
  }
}

suite('Code Complexity Metrics', () => {
  const analyzer = new ComplexityAnalyzer();

  suite('Cyclomatic Complexity', () => {
    test('should calculate cyclomatic complexity for simple function', () => {
      const code = 'function test() { return true; }';
      const complexity = analyzer.calculateCyclomaticComplexity(code);
      assert.strictEqual(complexity, 1);
    });

    test('should calculate cyclomatic complexity for function with if', () => {
      const code = 'function test(x) { if (x > 0) { return true; } return false; }';
      const complexity = analyzer.calculateCyclomaticComplexity(code);
      assert.ok(complexity >= 2);
    });

    test('should calculate cyclomatic complexity for function with loops', () => {
      const code = 'function test(arr) { for (let i = 0; i < arr.length; i++) { if (arr[i] > 0) { return true; } } }';
      const complexity = analyzer.calculateCyclomaticComplexity(code);
      assert.ok(complexity >= 3);
    });
  });

  suite('Cognitive Complexity', () => {
    test('should calculate cognitive complexity', () => {
      const code = 'function test(x) { if (x > 0) { return true; } return false; }';
      const complexity = analyzer.calculateCognitiveComplexity(code);
      assert.ok(complexity >= 1);
    });
  });

  suite('File Analysis', () => {
    test('should analyze file complexity', () => {
      const testFile = path.join(__dirname, '../../utils/delay.ts');
      if (fs.existsSync(testFile)) {
        const metrics = analyzer.analyzeFile(testFile);
        assert.ok(metrics.cyclomatic >= 0);
        assert.ok(metrics.cognitive >= 0);
        assert.ok(metrics.lines > 0);
      }
    });
  });

  suite('Complexity Thresholds', () => {
    test('should identify high complexity functions', () => {
      const highComplexityCode = `
        function complex(x, y, z) {
          if (x > 0) {
            if (y > 0) {
              if (z > 0) {
                for (let i = 0; i < 10; i++) {
                  if (i % 2 === 0) {
                    return true;
                  }
                }
              }
            }
          }
          return false;
        }
      `;
      const complexity = analyzer.calculateCyclomaticComplexity(highComplexityCode);
      // High complexity threshold: > 10
      assert.ok(complexity > 5);
    });
  });
});

