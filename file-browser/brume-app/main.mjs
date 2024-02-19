import './brume-elements.mjs';
import {Brume} from './node_modules/brume-client/Brume.mjs';
import {getToken} from './v4brumeLogin.mjs';

// Dialog
const cancelBtn = document.querySelector("#cancelBtn");
const OKBtn = document.querySelector("#OKBtn");
const dialogDiv = document.querySelector("#dialogDiv");
const dialogMsg = document.querySelector("#dialogMsg");

function btnHandler(e, res) {
	dialogDiv.hidden = true;
	cancelBtn.removeEventListener('click', btnHandler);
	OKBtn.removeEventListener('click', btnHandler);
	res(e.currentTarget.firstChild.data == 'OK' ? true : false);
}

function dialog(type, m){
	return new Promise((res, rej) => {
		dialogMsg.innerHTML = m;
		cancelBtn.style.visibility = type == 'alert' ? 'hidden' : 'visible';
		dialogDiv.hidden = false;
		cancelBtn.addEventListener('click', (e) => btnHandler(e, res));
		OKBtn.addEventListener('click', (e) => btnHandler(e, res));
	});
}; // end Dialog

const brume = new Brume(),
	callElem = customElements.get('brume-call') ? document.getElementById('call') : null,
	divLogin = document.querySelector('div#login'),
	divApp = document.querySelector('div#app'),
	inFile = document.querySelector('#inFile'),
	sendFile = document.querySelector('#sendFile'),
	saveFileBtn = document.querySelector('#saveFileBtn'),
	outFile = document.querySelector('#outFile');

let token = localStorage?.Authorization,
	triedLogin = false,
	thisPeer = undefined;

function endPeerConnection(peer = undefined) {
	if(peer) peer.destroy();
	callElem.call();
	callElem.name.value = '';
	sendFile.style.display = 'none';
	inFile.value = '';
}

let reader = null;

inFile.onchange = (evt) => {
	thisPeer.send(JSON.stringify({
		type: 'start',
		data: {
			name: inFile.files[0].name,
			size: inFile.files[0].size
		}
	}));
	const stream = inFile.files[ 0 ].stream();
	reader = stream.getReader();
};

let received = 0,
	size = 0,
	name = '',
	writableStream = null,
	MAX_SEND_SIZE = 64*1024,
	done, value = undefined, begin, end;

async function dataHandler(_msg) {
	let	msg = JSON.parse(_msg.toString());

	switch(msg.type) {
		case 'start':
			inFile.style.display = 'none';
			({name, size} = msg.data);
			saveFileBtn.style.display = '';
			outFile.style.display = '';
			saveFileBtn.addEventListener('click', async () => {
				const newHandle = await window.showSaveFilePicker({suggestedName: name});
				writableStream = await newHandle.createWritable();
				saveFileBtn.style.display = 'none';
				thisPeer.send(JSON.stringify({type: 'ready'}));
			});
			break;

		case 'chunk':
			const chunk = new Uint8Array(msg.data);
			received += chunk.length;
			await writableStream.write(chunk);
			thisPeer.send(JSON.stringify({type: 'ready'}));
			break;

		case 'eof':
			let status = received == size ? 'succeeded' : `failed: file size: ${size} received: ${received}`;
			thisPeer.send(JSON.stringify({type: 'result', status}));
			await writableStream.close();
			writableStream = null;
			received = 0;
			size = 0;
			name = '';
			outFile.style.display = 'none';
			inFile.style.display = '';
			await dialog('alert', 'Transfer ' + status);
			break;

		case 'ready':
			if(value == undefined) {
				({ done, value } = await reader.read());
				if(!done){ 
					begin=0, end=MAX_SEND_SIZE;
				} else {
					thisPeer.send(JSON.stringify({type: 'eof'}));
					break;
				}
			}

			thisPeer.send(JSON.stringify({type: 'chunk', data: Array.from(value.slice(begin, end))}));
			begin += MAX_SEND_SIZE, end += MAX_SEND_SIZE;
			if(begin > value.length) { value = undefined, begin = 0, end = MAX_SEND_SIZE; }
			break;

		case 'result':
			await dialog('alert', 'Transfer ' + msg.status);
			received = 0;
			size = 0;
			name = '';
			writableStream = null;
			reader = null;
			outFile.style.display = 'none';
			inFile.style.display = '';
			inFile.value = '';
			break;

		default:
	}
}

async function offerHandler({peer, accept}) {
	thisPeer = peer;
	if(await dialog('confirm', `Accept call from ${peer.peerUsername}?`)){
		peer.on('close', () => { console.log('close'); endPeerConnection(); });
		peer.on('error', err => {console.log(`peer error: ${err.code}`);});
		peer.on('data', dataHandler);
		await accept();
		callElem.name.value = `call from ${peer.peerUsername}`;
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
		sendFile.style.display = '';
	}
};

callElem.callBtn.addEventListener('click', async (e) => {	
	let peer = undefined;
	if (callElem.name.value.length > 0) { 
		try {
			peer = await brume.connect(callElem.name.value);
			thisPeer = peer;
		} catch(e) {
			dialog('alert', `Could not connect to ${callElem.name.value}`);
			return;
		}
		peer.on('close', () => { console.log('close'); endPeerConnection(); });
		peer.on('error', err => {console.log(`peer error: ${err.code}`);});
		peer.on('data', dataHandler);

		callElem.name.value = `call to ${peer.peerUsername}`;
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
		sendFile.style.display = '';
	}
});

callElem.call();
brume.onconnection = offerHandler;

while(true){
	try {
		if(!token) {
			divLogin.style.display = '';
			token = await getToken();
			//localStorage.Authorization = token;
			triedLogin = true;
		}
		await brume.start({token, url: 'wss://brume.occams.solutions/Prod'});
		break;
	} catch(e) {
		if(triedLogin) await dialog('alert', `Connection to Brume failed. Try signing in again.`);
		token = null;
		delete localStorage.Authorization;
	}
}

document.querySelector('#idP').innerHTML = `User: ${brume.thisUser}`;
divLogin.style.display = 'none';
divApp.style.display = '';
