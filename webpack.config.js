
const path = require('path');

module.exports = {
	mode: "development",
	entry: "./src/index.js",
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "app.js",
		libraryTarget: 'umd',
	},
	target: "web",
	devServer: {
		contentBase: "./dist",
	},
}
