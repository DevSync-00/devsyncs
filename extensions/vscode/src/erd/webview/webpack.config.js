const path = require('path')

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'web',
  entry: path.resolve(__dirname, 'main.tsx'),
  output: {
    filename: 'erd-webview.js',
    path: path.resolve(__dirname, '../../../out/erd/webview'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              jsx: 'react',
            },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  devtool: 'source-map',
}

