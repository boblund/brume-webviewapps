'use strict';

import { Webview } from 'webview-nodejs';
//import {open_file, save_file} from './portableDialogsJs.js';
import fs from 'fs';
import {join} from 'path';
import {URL} from 'url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdjs = require('./addon_pdjs.node');

const __dirname = new URL('.', import.meta.url).pathname;
const htmlFile = 'index.html';

function main() {
	const w = new Webview(true);
	w.title("File Browser Brume");
	w.size(600, 400);
	w.navigate(`file://${join(__dirname, htmlFile)}`);
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
	`);

	w.bind('consoleLog', (w, msg) => { console.log(msg); });

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

	/*const wvDir = `${process.env.HOME}/.webview`;
	if(!existsSync(wvDir)){ mkdirSync(wvDir, 0x744); }
	const localStorageFile = `${wvDir}/localStorage_min_ed`;

	w.init(`
		const handler = {
			get(target, prop) { return target[prop]; },
			set(target, prop, value) {
				target[prop] = value;
				savelocalStorage(JSON.stringify(target)); 
			},
		};

		let lc = ${readFileSync(localStorageFile).toString()};
		console.log(${readFileSync(localStorageFile).toString()});
		for(const [key, val] of Object.entries(${readFileSync(localStorageFile).toString()})){
			localStorage[key] = val;
		}

		wvlocalStorage = new Proxy(localStorage, handler);
	`);

	w.bind('savelocalStorage', (w, contents) =>  { writeFileSync(localStorageFile, contents); });*/

	w.show();
};

main();
