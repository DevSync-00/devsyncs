import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000, // 10 second timeout
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }).then((files) => {
      // Sort files: unit tests first, then integration tests
      const sortedFiles = files.sort((a, b) => {
        const aIsIntegration = a.includes('integration');
        const bIsIntegration = b.includes('integration');
        if (aIsIntegration && !bIsIntegration) return 1;
        if (!aIsIntegration && bIsIntegration) return -1;
        return a.localeCompare(b);
      });

      // Add files to the test suite
      sortedFiles.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run((failures: number) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    }).catch((err) => {
      e(err);
    });
  });
}

