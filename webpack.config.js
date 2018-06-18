const path = require('path')

const SOURCE_PATH = path.resolve('./src')
const BUILD_PATH = path.resolve('./dist')
const PUBLIC_PATH = '/dist'


module.exports = {
  // context:入口路径
  context: SOURCE_PATH,
  entry: {
    'origin': ['./apps/origin.js'],
    // 'genetic': ['./apps/genetic.js'],
    // 'genetic-nn': ['./apps/genetic-nn.js'],
    // nn: ['./apps/nn.js'],
    // nnm: ['./apps/nnm.js'],
    // random: ['./apps/random.js']
  },
  output: {
    path: BUILD_PATH,
    publicPath: PUBLIC_PATH,
    filename: './[name].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          chunks: 'initial',
          name: 'vendor',
          priority: 10,
          enforce: true
        }
      }
    }
  }

}