/**
 * Maintainability index tests.
 * 
 * Tests for calculating and tracking maintainability index.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Maintainability index calculator
 */
class MaintainabilityIndex {
  /**
   * Calculate maintainability index (0-100 scale)
   * Formula: MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
   */
  calculate(
    halsteadVolume: number,
    cyclomaticComplexity: number,
    linesOfCode: number
  ): number {
    const mi = 171 -
      5.2 * Math.log(halsteadVolume || 1) -
      0.23 * cyclomaticComplexity -
      16.2 * Math.log(linesOfCode || 1);

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, mi));
  }

  /**
   * Calculate Halstead volume (simplified)
   */
  calculateHalsteadVolume(code: string): number {
    // Simplified calculation
    const operators = (code.match(/[+\-*/=<>!&|?:,;.(){}[\]]/g) || []).length;
    const operands = (code.match(/\b\w+\b/g) || []).length;
    const vocabulary = new Set([
      ...(code.match(/[+\-*/=<>!&|?:,;.(){}[\]]/g) || []),
      ...(code.match(/\b\w+\b/g) || []),
    ]).size;

    return vocabulary * Math.log2(operators + operands || 1);
  }

  /**
   * Analyze file maintainability
   */
  analyzeFile(filePath: string): {
    maintainabilityIndex: number;
    halsteadVolume: number;
    cyclomaticComplexity: number;
    linesOfCode: number;
    rating: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const linesOfCode = content.split('\n').length;
    const halsteadVolume = this.calculateHalsteadVolume(content);
    
    // Simplified cyclomatic complexity
    const cyclomaticComplexity = (content.match(/if\s*\(|for\s*\(|while\s*\(|switch\s*\(/g) || []).length + 1;
    
    const mi = this.calculate(halsteadVolume, cyclomaticComplexity, linesOfCode);
    
    let rating: 'excellent' | 'good' | 'fair' | 'poor';
    if (mi >= 80) {
      rating = 'excellent';
    } else if (mi >= 60) {
      rating = 'good';
    } else if (mi >= 40) {
      rating = 'fair';
    } else {
      rating = 'poor';
    }

    return {
      maintainabilityIndex: mi,
      halsteadVolume,
      cyclomaticComplexity,
      linesOfCode,
      rating,
    };
  }
}

suite('Maintainability Index Tests', () => {
  const calculator = new MaintainabilityIndex();

  suite('Maintainability Index Calculation', () => {
    test('should calculate maintainability index', () => {
      const mi = calculator.calculate(100, 5, 50);
      assert.ok(mi >= 0 && mi <= 100);
    });

    test('should rate code as excellent for high MI', () => {
      const mi = calculator.calculate(50, 2, 20);
      assert.ok(mi >= 80);
    });

    test('should rate code as poor for low MI', () => {
      const mi = calculator.calculate(1000, 50, 500);
      assert.ok(mi < 40);
    });
  });

  suite('Halstead Volume', () => {
    test('should calculate Halstead volume', () => {
      const code = 'function test(x, y) { return x + y; }';
      const volume = calculator.calculateHalsteadVolume(code);
      assert.ok(volume >= 0);
    });
  });

  suite('File Analysis', () => {
    test('should analyze file maintainability', () => {
      const testFile = path.join(__dirname, '../../utils/delay.ts');
      if (fs.existsSync(testFile)) {
        const analysis = calculator.analyzeFile(testFile);
        assert.ok(analysis.maintainabilityIndex >= 0 && analysis.maintainabilityIndex <= 100);
        assert.ok(['excellent', 'good', 'fair', 'poor'].includes(analysis.rating));
      }
    });
  });
});

