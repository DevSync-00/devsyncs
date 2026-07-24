import readline from 'readline';

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

  console.log(message);
  options.forEach((option, index) => {
    const description = option.description ? ` - ${option.description}` : '';
    console.log(`  ${index + 1}. ${option.label}${description}`);
  });

  const answer = await promptInput('Choose an option');
  if (!answer) return undefined;
  const selectedIndex = Number.parseInt(answer, 10) - 1;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= options.length) {
    console.log('Invalid selection.');
    return undefined;
  }
  return options[selectedIndex].value;
}

export async function promptYesNo(message: string, defaultYes = false): Promise<boolean> {
  if (!isInteractive()) return defaultYes;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} ${defaultYes ? '[Y/n]' : '[y/N]'} `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (!normalized) return resolve(defaultYes);
      if (normalized === 'y' || normalized === 'yes') return resolve(true);
      if (normalized === 'n' || normalized === 'no') return resolve(false);
      return resolve(defaultYes);
    });
  });
}

export async function promptInput(message: string): Promise<string | undefined> {
  if (!isInteractive()) return undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message}: `, (answer) => {
      rl.close();
      const value = answer.trim();
      resolve(value.length > 0 ? value : undefined);
    });
  });
}

