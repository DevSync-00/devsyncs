/**
 * Onboarding module for DevSync.
 * 
 * Provides interactive setup wizard, schema detection, connection testing,
 * and quick start templates.
 */

export { OnboardingWizard, WizardStep, WizardData, WizardStepResult, ValidationResult } from './wizard';
export { PrismaSchemaDetector } from './schemaDetector';
export { DatabaseConnectionTester, ConnectionTestResult } from './connectionTester';
export { QuickStartManager, QuickStartTemplate, TemplateFile } from './quickStart';

