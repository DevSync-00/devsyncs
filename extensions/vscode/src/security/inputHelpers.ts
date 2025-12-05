/**
 * Helper functions for validating user inputs from VS Code UI.
 * 
 * Provides wrappers around VS Code input methods with automatic validation.
 */

import * as vscode from 'vscode';
import { InputValidator, ValidationOptions } from './inputValidation';
import { TypeValidator } from './typeValidation';

/**
 * Show input box with validation
 * 
 * @param options - Input box options
 * @param validationOptions - Validation options
 * @returns User input or undefined if cancelled
 */
export async function showValidatedInputBox(
  options: vscode.InputBoxOptions,
  validationOptions?: ValidationOptions
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const inputBox = vscode.window.createInputBox();
    inputBox.title = options.title;
    inputBox.prompt = options.prompt;
    if (options.placeHolder) {
      inputBox.placeholder = options.placeHolder;
    }
    inputBox.password = options.password || false;
    inputBox.value = options.value || '';
    inputBox.ignoreFocusOut = options.ignoreFocusOut || false;

    let lastValidValue: string | undefined;

    inputBox.onDidChangeValue((value) => {
      // Validate input
      const validation = InputValidator.validateString(value, validationOptions);
      
      if (validation.valid) {
        inputBox.validationMessage = undefined;
        lastValidValue = validation.sanitized;
      } else {
        inputBox.validationMessage = validation.error || 'Invalid input';
        lastValidValue = undefined;
      }
    });

    inputBox.onDidAccept(() => {
      if (lastValidValue !== undefined) {
        inputBox.dispose();
        resolve(lastValidValue);
      }
    });

    inputBox.onDidHide(() => {
      inputBox.dispose();
      resolve(undefined);
    });

    inputBox.show();
  });
}

/**
 * Show quick pick with validation
 * 
 * @param items - Quick pick items
 * @param options - Quick pick options
 * @param validationOptions - Validation options for custom input
 * @returns Selected item or undefined if cancelled
 */
export async function showValidatedQuickPick<T extends vscode.QuickPickItem>(
  items: T[],
  options?: vscode.QuickPickOptions & {
    canSelectMany?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
  },
  validationOptions?: ValidationOptions
): Promise<T | T[] | undefined> {
  return vscode.window.showQuickPick(items, options);
}

/**
 * Validate and sanitize user input from any source
 * 
 * @param value - User input value
 * @param options - Validation options
 * @returns Validation result with sanitized value
 */
export function validateUserInput(value: unknown, options?: ValidationOptions) {
  return InputValidator.validateString(value, options);
}

/**
 * Validate configuration input
 * 
 * @param key - Configuration key
 * @param value - Configuration value
 * @returns Validation result
 */
export function validateConfigInput(key: string, value: unknown) {
  // Validate key
  const keyValidation = InputValidator.validateIdentifier(key, {
    maxLength: 255,
    minLength: 1,
  });

  if (!keyValidation.valid) {
    return {
      valid: false,
      error: `Invalid configuration key: ${keyValidation.error}`,
    };
  }

  // Validate value based on type
  if (typeof value === 'string') {
    return InputValidator.validateString(value, {
      maxLength: 10000,
      blockedPatterns: [
        ...InputValidator.getSqlInjectionPatterns(),
        ...InputValidator.getXssPatterns(),
      ],
    });
  }

  if (typeof value === 'number') {
    return InputValidator.validateNumber(value);
  }

  if (typeof value === 'boolean') {
    return TypeValidator.validateBoolean(value);
  }

  return {
    valid: false,
    error: `Unsupported configuration value type: ${typeof value}`,
  };
}

