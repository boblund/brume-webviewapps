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
	divApp = document.querySelector('div#app');

let token = localStorage?.Authorization,
	triedLogin = false,
	localStream = null;;

function endPeerConnection(peer = undefined) {
	if(peer) peer.destroy();
	callElem.call();
	callElem.name.value = '';

	if(localStream != null) {
		localStream.getTracks().forEach(media => { media.enabled = false; });
		localStream.getVideoTracks()[0].stop();
		localStream = null;
	}
	firstUserGesture = true;

	Array.from(document.getElementsByTagName('video')).forEach(video => {
		video.pause();
		video.src = '';
		video.srcObject = null;  
		video.load();
	});

	localButton.style.textDecoration = 'line-through';
	remoteButton.innerHTML = 'Remote video';
	remoteButton.style.textDecoration = 'line-through';
	remoteDiv.style.visibility = 'hidden';
	localDiv.style.visibility = 'hidden';
}

async function getMedia() {
	if(localStream == null){
		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});
		} catch (error) {
			alert(`navigator.mediaDevices.getUserMedia: ${error.name}`);
			console.error(`navigator.mediaDevices.getUserMedia: ${JSON.stringify(error)}`);
		}

		localStream.getTracks().forEach(media => {
			media.enabled = false;
		});

		document.querySelector('video#local').srcObject = localStream;
	}
	return localStream;
}

const localDiv = document.getElementById('localDiv');
const localButton = document.querySelector('button.local');
const remoteDiv = document.getElementById('remoteDiv');
const remoteButton = document.querySelector('button.remote');

localButton.addEventListener('click', ()=>{toggle('local');});
remoteButton.addEventListener('click', ()=>{toggle('remote');});

remoteDiv.style.visibility = 'hidden';
localDiv.style.visibility = 'hidden';
localButton.style.textDecoration = 'line-through';
remoteButton.style.textDecoration = 'line-through';

let peerUsername = undefined;

//async function offerHandler(peer) { //{peer, accept}
async function offerHandler({peer, accept}) {
	if(await dialog('confirm', `Accept call from ${peer.peerUsername}?`)){
		peer.on('stream', async stream => {
			const video = document.querySelector('video#remote');
			if ('srcObject' in video) {
				video.srcObject = stream;
			} else {
				video.src = window.URL.createObjectURL(stream); // for older browsers
			}

			document.querySelector('#remoteDiv').style.visibility = 'visible';
	
			// Create and add localStream to peer
			localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			localStream.getTracks().forEach(media => { media.enabled = false; });
			peer.addStream(localStream);
			peer.streamAdded = true;
	
			// Enable localStream display
			document.querySelector('video#local').srcObject = localStream;
			document.querySelector('#localDiv').style.visibility = 'visible';
			remoteButton.innerHTML = `${peer.peerUsername}'s video`;
		});

		peer.on('close', () => { endPeerConnection(); });
		
		await accept();
		callElem.name.value = `call from ${peer.peerUsername}`;
		peerUsername = peer;
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
	}
};

callElem.callBtn.addEventListener('click', async (e) => {	
	let peer = undefined;	 
	if (callElem.name.value.length > 0) { 
		try {
			peer = await brume.connect(callElem.name.value);
			peer.on('stream', stream => {
				const video = document.querySelector('video#remote');
				if ('srcObject' in video) {
					video.srcObject = stream;
				} else {
					video.src = window.URL.createObjectURL(stream); // for older browsers
				}
				document.querySelector('#remoteDiv').style.visibility = 'visible';
			});

			peerUsername = callElem.name.value;
			localDiv.style.visibility = 'visible';
			remoteButton.innerHTML = `${callElem.name.value}'s video`;

			// Create and send localStream
			localStream = await getMedia();
			peer.addStream(localStream);
		} catch(e) {
			dialog('alert', `Could not connect to ${callElem.name.value}`);
			return;
		}

		peer.on('close', () => {
			endPeerConnection();
		});
		callElem.hangUpBtn.addEventListener("click", () => { endPeerConnection(peer); });
		callElem.hangUp();
		peer.send(`Hi ${callElem.name.value}`);
	}
});

let firstUserGesture = true;
function toggle(buttonName) {
	const button = document.querySelector('#' + buttonName + 'Button');
	const player = document.querySelector('video#'+buttonName);

	if(buttonName == 'local') {
		if(firstUserGesture) {
			player.play();
			button.style.textDecoration = '';
			firstUserGesture = false;

			localStream.getTracks().forEach(media => {
				media.enabled = true;
			});

			return;
		} else {
			button.style.textDecoration = button.style.textDecoration == 'line-through' ? '' : 'line-through';
			localStream.getTracks().forEach(media => {
				media.enabled = media.enabled ? false : true;
			});
		}
	} else {
		if (player.paused) {
			player.play();
			player.muted = false;
			button.style.textDecoration = '';
		} else {
			player.src='';
			player.pause();
			player.muted = true;
			button.style.textDecoration = 'line-through';
		}
	}
};

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
