const path = require('path');
const webpack = require('webpack');

module.exports = {
	mode: 'development',
	devtool: false,
	//entry: ['./brume-app/main.mjs'],
	entry: [path.join(__dirname, "brume-app/main.mjs")],
	output: {
	//path: path.resolve(__dirname),
		path: __dirname,
		filename: 'main.js'
	},
	module: {
		rules: [{
			use: [ 
				{ loader: "ifdef-loader", options: {
					WEBPACK: true,
					"ifdef-uncomment-prefix": "// #code "
				} }
			]
		}]
	},
	resolve:{
		fallback: { path: require.resolve("path-browserify")}
	},

	plugins: [
	// fix "process is not defined" error:
		new webpack.ProvidePlugin({
			process: 'process/browser',
		}),
	]
};
