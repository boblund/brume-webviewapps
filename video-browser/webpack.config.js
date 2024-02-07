var path = require("path");

module.exports = {
	//entry: ['/Users/blund/Documents/swdev/webview-nodejs-apps/x-browserBrume/main.mjs'], //[path.join(__dirname, "cip.mjs")],
	mode: 'development',
	devtool: false,
	entry: [path.join(__dirname, "brume-app/cognitoAuth.mjs")],
	output: {
		library: 'Cognito',
		path: __dirname,
		filename: 'brume-app/cognitoAuth.js'
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
	}
};
