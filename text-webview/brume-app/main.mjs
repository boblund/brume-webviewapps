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
	msgInput = document.querySelector('#msgInput'),sendMsgBtn = document.querySelector('#sendMsgBtn'),
	chatArea = document.querySelector('#chatarea'),
	chatInput = document.querySelector('#chatInput');

let token = localStorage?.Authorization,
	triedLogin = false,
	thisPeer = undefined;

function endPeerConnection(peer = undefined) {
	if(peer) peer.destroy();
	chatArea.innerHTML = '';
	chatArea.style.display = 'none';
	chatInput.style.display = 'none';
	callElem.call();
	callElem.name.value = '';
}

async function offerHandler({peer, accept}) {
	thisPeer = peer;
	if(await dialog('confirm', `Accept call from ${peer.peerUsername}?`)){
		peer.on('close', () => {
			endPeerConnection();
		});
		peer.on('data', data => {
			chatArea.innerHTML += `${peer.peerUsername}: ${data.toString()} </br>`; 
			chatArea.scrollTop = chatArea.scrollHeight;
		});
		await accept();
		callElem.name.value = `call from ${peer.peerUsername}`;
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
		chatArea.style.display = '';
		chatInput.style.display = '';
	}
};

callElem.callBtn.addEventListener('click', async (e) => {		 
	if (callElem.name.value.length > 0) { 
		let peer = undefined;
		try {
			peer = await brume.connect(callElem.name.value);
			thisPeer = peer;
		} catch(e) {
			dialog('alert', `Could not connect to ${callElem.name.value}`);
			return;
		}
		peer.on('close', () => {
			endPeerConnection();
		});

		peer.on('data', data => {
			chatArea.innerHTML += `${peer.peerUsername}: ${data.toString()} </br>`; 
			chatArea.scrollTop = chatArea.scrollHeight;
		});

		callElem.name.value = `call to ${peer.peerUsername}`;
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
		chatArea.style.display = '';
		chatInput.style.display = '';
	}
});

sendMsgBtn.addEventListener("click", function(event){ 
	var val = msgInput.value; 
	chatArea.innerHTML += brume.thisUser + ": " + val + "<br />";
	chatArea.scrollTop = chatArea.scrollHeight;
	thisPeer.send(val); 
	msgInput.value = ""; 
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
