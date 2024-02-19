'use strict';

import { Webview } from 'webview-nodejs';
import * as fs from 'fs';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url),
	pdjs = require('./addon_pdjs.node');

const {title, size:[width,height], url, debug} = JSON.parse(process.argv[2]),
	w = new Webview(debug);
	
w.title(title);
w.size(width, height);
w.navigate(url);

const wvDir = `${process.env.HOME}/.webview`;
if(!fs.existsSync(wvDir)){ fs.mkdirSync(wvDir, 0x744); }
let localStorageFile = `${wvDir}/localStorage_brumebrowser`,
	localStorageJson = {};

try { localStorageJson = fs.readFileSync(localStorageFile).toString(); }
catch(e) {}

w.init(`
	window.webview=true;
	window.console.log = (s) => consoleLog(s);

	window.showSaveFilePicker = window?.showSaveFilePicker
	? window.showSaveFilePicker
	: async function showSaveFilePicker(options){
			const filePath = await nodeSFP('showSaveFilePicker', options);
			return filePath != ''
				? new function()  {
						this.createWritable = async () => {
							const fd = await nodeSFP('createWritable', filePath);
							return new function(){
								this.write = async (chunk) => {
									//chunk = (new TextDecoder('utf-8')).decode(chunk);
									await nodeSFP('write', fd, Array.from(chunk));
								};
								this.end = async (chunk) => {
									//chunk = (new TextDecoder('utf-8')).decode(chunk);
									await nodeSFP('end', fd, Array.from(chunk));
								};
								this.close = async () => { await nodeSFP('close', fd); };
							}
						};
					}
				: undefined;
		};

	for(const [key, value] of Object.entries(${localStorageJson})){
		localStorage[key] = value;
	}
	
	const handler = {
		get(target, prop) { return target[prop]; },
		async set(target, prop, value) {
			target[prop] = value;
			await savelocalStorage(target); 
		},
		async deleteProperty(target, prop) {
			delete target[prop];
			await savelocalStorage(target);
		}
	};

	wvlocalStorage = new Proxy(localStorage, handler);
	delete window.localStorage;
	window.localStorage = wvlocalStorage;

`);

w.bind('consoleLog', (w, msg) => { process.send(msg); });

w.bind('savelocalStorage', (w, contents) =>  {
	fs.writeFileSync(localStorageFile, JSON.stringify(contents));
});

w.bind("nodeSFP", (w,...args)=>{
	switch(args[0]){
		case 'showSaveFilePicker':
			const filePath = pdjs.save_file(args[1].suggestedName);
			return filePath;
			break;

		case 'createWritable':
			return fs.openSync(args[1], 'w');
			break;

		case 'write':
			fs.writeSync(args[1], new Uint8Array(args[2]));
			break;

		case 'end':
			fs.writeSync(args[1],new Uint8Array(args[2]));
		case 'close':
			fs.closeSync(args[1]);
			break;

		default:
	}
});

w.show();
