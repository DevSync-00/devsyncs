const path = require('path');
module.exports = {
  mode: 'production', target: 'web', entry: './webview-ui/index.tsx',
  output: { path: path.resolve(__dirname, 'out', 'webview'), filename: 'cockpit.js' },
  resolve: { extensions: ['.tsx','.ts','.js'] },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: { loader:'ts-loader', options:{ configFile:'tsconfig.webview.json' } } }] },
  optimization: { minimize: true }, devtool: false,
};
