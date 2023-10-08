const path = require("path");
module.exports = {
  entry: "./simulator/app.js", // Entry point of your app
  output: {
    filename: "bundle.js", // The bundled output file
    path: path.resolve(__dirname, "dist"), // Output directory
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader", // Use ts-loader for ts files
          options: {
            transpileOnly: true, // skip type checking 
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  mode: "development", // Use 'production' for production builds
  devServer: {
    contentBase: path.join(__dirname, "public"), // where your index.html file is located
    compress: true,
    port: 9000,
  },
};
