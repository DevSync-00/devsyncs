import readline from 'readline';

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
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

