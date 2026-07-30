import {
  confirm as inquirerConfirm,
  input as inquirerInput,
  select as inquirerSelect,
} from '@inquirer/prompts';

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export interface SelectOption<T> {
  label: string;
  value: T;
  description?: string;
}

export async function promptSelect<T>(
  message: string,
  options: SelectOption<T>[]
): Promise<T | undefined> {
  if (!isInteractive() || options.length === 0) return undefined;

  try {
    return await inquirerSelect<T>({
      message,
      choices: options.map((option) => ({
        name: option.label,
        value: option.value,
        description: option.description,
      })),
      pageSize: Math.min(Math.max(options.length, 5), 12),
      loop: false,
    });
  } catch (error) {
    if (isPromptCancellation(error)) return undefined;
    throw error;
  }
}

function isPromptCancellation(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'ExitPromptError' ||
    error.message.includes('User force closed the prompt')
  );
}

export async function promptYesNo(message: string, defaultYes = false): Promise<boolean> {
  if (!isInteractive()) return defaultYes;

  try {
    return await inquirerConfirm({
      message,
      default: defaultYes,
    });
  } catch (error) {
    if (isPromptCancellation(error)) return defaultYes;
    throw error;
  }
}

export async function promptInput(message: string): Promise<string | undefined> {
  if (!isInteractive()) return undefined;

  try {
    const value = await inquirerInput({ message });
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch (error) {
    if (isPromptCancellation(error)) return undefined;
    throw error;
  }
}

