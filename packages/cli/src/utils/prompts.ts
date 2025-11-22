import * as readline from 'readline';
import chalk from 'chalk';

export interface Choice {
  name: string;
  value: string;
}

/**
 * Create a readline interface for user input
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user to select from choices
 */
export async function selectPrompt(
  message: string,
  choices: Choice[]
): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    
    console.log(chalk.blue(`\n${message}\n`));
    choices.forEach((choice, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${choice.name}`));
    });
    console.log();
    
    const ask = () => {
      rl.question(chalk.gray('Select an option (1-' + choices.length + '): '), (answer) => {
        const index = parseInt(answer, 10) - 1;
        if (index >= 0 && index < choices.length) {
          rl.close();
          resolve(choices[index].value);
        } else {
          console.log(chalk.red('Invalid selection. Please try again.'));
          ask();
        }
      });
    };
    
    ask();
  });
}

/**
 * Prompt user for text input
 */
export async function inputPrompt(
  message: string,
  defaultValue?: string
): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    const prompt = defaultValue 
      ? `${chalk.blue(message)} ${chalk.gray(`(default: ${defaultValue})`)}: `
      : `${chalk.blue(message)}: `;
    
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Prompt user for sensitive input (like passwords)
 */
export async function passwordPrompt(message: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    
    // Hide input on Windows
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (!wasRaw) {
      stdin.setRawMode(true);
    }
    
    process.stdout.write(chalk.blue(message + ': '));
    
    let input = '';
    stdin.on('data', function listener(char: Buffer) {
      char = char as unknown as Buffer;
      const charStr = char.toString();
      
      switch (charStr) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(wasRaw);
          stdin.removeListener('data', listener);
          stdin.pause();
          console.log();
          resolve(input);
          break;
        case '\u0003': // Ctrl+C
          stdin.setRawMode(wasRaw);
          stdin.removeListener('data', listener);
          stdin.pause();
          console.log();
          process.exit(0);
          break;
        case '\u007f': // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          input += charStr;
          process.stdout.write('*');
          break;
      }
    });
    
    stdin.resume();
  });
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirmPrompt(message: string, defaultValue: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface();
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    rl.question(`${chalk.blue(message)} ${chalk.gray(`(${defaultText})`)}: `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === '') {
        resolve(defaultValue);
      } else {
        resolve(normalized === 'y' || normalized === 'yes');
      }
    });
  });
}

