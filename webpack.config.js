var nodeExternals = require('webpack-node-externals');
var Dotenv = require('dotenv-webpack');

var dotEnvConfig = {
  path: './.env',
  safe: './dev.env', // load '.dev.env' to verify the '.env' variables are all set. Can also be a string to a different file.
  systemvars: true, // load all the predefined 'process.env' variables which will trump anything local per dotenv specs.
}

var serverConfig = {
  entry: ["babel-polyfill", './src/index.js'],
  output: {
    filename: './index.js',
    libraryTarget: 'commonjs2'
  },
  mode: 'development',
  devtool: 'inline-cheap-module-source-map',
  target: 'node',
  externals: [nodeExternals()],
  plugins: [
    new Dotenv(dotEnvConfig)
  ],
  resolve: {
    /**
    * Overriding the default to allow jsx to be resolved automatically.
    */
    extensions: ['.js', '.json', '.jsx'],
    /**
    * Access config from anywhere via `import settings from 'settings'``
    */
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['env', 'es2015', 'react'],
          plugins: ['transform-class-properties']
        }
      }
    ]
  }
}

var clientConfig = {
  entry: ["babel-polyfill", './src/index.js'],
  output: {
    filename: './origin.js',
    libraryTarget: 'var',
    library: 'Origin'
  },
  mode: 'production',
  devtool: false,
  target: 'web',
  plugins: [
    new Dotenv(dotEnvConfig)
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['babel-preset-es2015'],
          plugins: ['transform-class-properties']
        }
      }
    ]
  }

}

module.exports = [ serverConfig, clientConfig ];
