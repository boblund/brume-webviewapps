'use strict';

import { Webview } from 'webview-nodejs';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';

const {title, size:[width,height], url, debug} = JSON.parse(process.argv[2]),
	w = new Webview(debug);
	
w.title(title);
w.size(width, height);
w.navigate(url);

const wvDir = `${process.env.HOME}/.webview`;
if(!existsSync(wvDir)){ mkdirSync(wvDir, 0x744); }
let localStorageFile = `${wvDir}/localStorage_brumebrowser`,
	localStorageJson = {};

try { localStorageJson = readFileSync(localStorageFile).toString(); }
catch(e) {}

w.init(`
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
	
	window.console.log = (s) => consoleLog(s);
`);

w.bind('savelocalStorage', (w, contents) =>  {
	writeFileSync(localStorageFile, JSON.stringify(contents));
});

w.bind('consoleLog', (w, msg) => { process.send(msg); });

w.show();
