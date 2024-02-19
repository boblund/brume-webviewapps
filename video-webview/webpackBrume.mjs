'use strict';

import { Webview } from 'webview-nodejs';
import {join} from 'path';
import {URL} from 'url';

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
	`);

	w.bind('consoleLog', (w, msg) => { console.log(msg); });

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
