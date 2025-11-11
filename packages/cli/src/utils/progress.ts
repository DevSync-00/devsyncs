/**
 * Progress indicator utilities
 */
export interface ProgressOptions {
  total?: number;
  message?: string;
  showPercentage?: boolean;
}

export class ProgressIndicator {
  private current = 0;
  private total?: number;
  private message?: string;
  private showPercentage: boolean;
  private startTime: number;

  constructor(options: ProgressOptions = {}) {
    this.total = options.total;
    this.message = options.message;
    this.showPercentage = options.showPercentage ?? true;
    this.startTime = Date.now();
  }

  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  increment(message?: string): void {
    this.current++;
    if (message) {
      this.message = message;
    }
    this.render();
  }

  complete(message?: string): void {
    this.current = this.total || this.current;
    if (message) {
      this.message = message;
    }
    this.render();
    process.stdout.write('\n');
  }

  private render(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    let output = '\r';

    if (this.message) {
      output += this.message;
    }

    if (this.total !== undefined) {
      const percentage = Math.round((this.current / this.total) * 100);
      output += ` [${this.current}/${this.total}]`;
      
      if (this.showPercentage) {
        output += ` ${percentage}%`;
      }
    } else {
      output += ` [${this.current}]`;
    }

    output += ` (${elapsed}s)`;

    process.stdout.write(output);
  }
}

/**
 * Simple spinner for indeterminate progress
 */
export class Spinner {
  private interval?: NodeJS.Timeout;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private message: string;

  constructor(message: string = '') {
    this.message = message;
  }

  start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 100);
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      process.stdout.write('\r');
      if (message) {
        console.log(message);
      }
    }
  }

  update(message: string): void {
    this.message = message;
  }
}

