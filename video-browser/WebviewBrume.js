#!/usr/bin/env node

// License: Creative Commons Attribution-NonCommercial 4.0 International
// THIS SOFTWARE COMES WITHOUT ANY WARRANTY, TO THE EXTENT PERMITTED BY APPLICABLE LAW.

'use strict';

const { join } = require('path'),
	{ fork } = require('child_process'),
	server = require('./server/server.js'),
	title = process.argv[1].split('/').pop().replace('.js', ''),
	size = [700, 400],
	appWebDir = 
		//'/Users/blund/Documents/swdev/brumeDemos/simplePeer/wv-video';
		'./brume-app';

process.on('SIGINT', ()=> { process.exit(2); });

(async function(){
	try {
		const serverPort = await server(appWebDir);
		console.log(serverPort);
		const webviewChild = fork(
			join(__dirname, './webview.mjs'),
			[JSON.stringify({ title, size, url: `http://127.0.0.1:${serverPort}`, debug: true })],
			{ silent: true }
		);

		webviewChild.on('message', msg => 
			console.log(msg));
		webviewChild.on('exit', ()=>{ process.exit(); });
	} catch(e){
		console.error(e);
	}
})();
