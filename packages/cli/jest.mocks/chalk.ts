type ChalkFn = ((input: string) => string) & Record<string, (input: string) => string>;

const createChalk = (): ChalkFn => {
  const passthrough = (input: string) => input;
  const fn = passthrough as ChalkFn;
  const styles = ['red', 'green', 'yellow', 'blue', 'blueBright', 'cyan', 'gray', 'underline', 'bold'];
  styles.forEach((style) => {
    fn[style] = passthrough;
  });
  return fn;
};

const chalk = createChalk();
export default chalk;

