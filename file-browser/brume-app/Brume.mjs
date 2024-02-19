export {Brume, userPassAuth};

const jwt = {decode(t){return JSON.parse(atob(t.split('.')[1])); }},
	OFFERTIMEOUT = 5 * 60 * 1000; // 5 minutes

/// #if WEBPACK

// #code import {EventEmitter} from 'events'; //webpack/fileGroup
// #code import SimplePeer  from 'simple-peer';
// #code import {Channel} from 'Channel';
// #code import {userPassAuth} from './cognitoAuth.mjs';

/// #else

let wrtc, EventEmitter, SimplePeer, Channel, refreshTokenAuth, userPassAuth;

if(typeof window == 'undefined') {
	({refreshTokenAuth} = await import('./cognitoAuth.mjs'));
	EventEmitter = (await import('events')).default;
	SimplePeer = (await import('simple-peer')).default;
	({Channel} = await import('Channel'));
	wrtc = (await import('@koush/wrtc')).default;
	global.WebSocket = (await import('ws')).default;
} else {
	await import('/node_modules/browser-cjs/require.js');
	EventEmitter = require('/node_modules/events/events.js');
	SimplePeer = require('/node_modules/simple-peer/simplepeer.min.js');
	({Channel} = await import('/node_modules/Channel/Channel.mjs'));
	const {Cognito} = require('./cognitoAuth.js');
	userPassAuth = Cognito.userPassAuth;
}

/// #endif


const	CLIENTID = '6dspdoqn9q00f0v42c12qvkh5l',
	errorCodeMessages = {
		400: 'Missing token',
		401: 'Unauthorized',
		402: 'Payment required',
		403: 'Invalid server url',
		404: 'This user is unknown',
		406: 'Bad token',
		409: 'This user is already connected',
		500: 'Server error',
		501: 'Server error',
		ECONNREFUSED: '',
		ENOTFOUND: '',
		ENODEST: '',
		EOFFERTIMEOUT: '',
		NotAuthorizedException: 'Invalid Refresh Token'
	};

function wsConnect({token, url}) {
	return new Promise((res, rej) => {	
		let ws = typeof window == undefined
			? new WebSocket(url, { headers : { token }, rejectUnauthorized: false })
			: new WebSocket(`${url}?token=${token}`);

		//ws.on('pong', ()=>{});
		ws.onopen = () => { res(ws); };

		ws.onerror = err => {
			// make codes recognize: ECONNREFUSED, ENOTFOUND in err.message
			const code = err?.message
				? err?.message.match(/: (\d*)/) 
					? err.message.match(/: (\d*)/)[1]
					: undefined
				: undefined;
			rej(code && errorCodeMessages[code] ? {message:`${errorCodeMessages[code]} ${code}`, code} : err);
		};

	});
}

function setPingInterval(ws){
	return typeof ws?.ping === 'function'
		? setInterval(function(){ws.ping(()=>{});}, 9.8 * 60 * 1000)
		: null;
}

class Brume extends EventEmitter {
	#user = undefined;
	#ws = undefined;
	#peers = {};
	#config = undefined;
	#offerProcessor;
	#connectionQ;

	constructor(config){
		super();
		try {
			if(config){
				this.#config = config;
				this.#user = jwt.decode(config.token)['custom:brume_name'];
			}
			this.#connectionQ = new Channel;
		} catch(e) { throw(e); }
	}

	async #openWs({token, url}){
		this.#ws = await wsConnect({token, url});
		const pingInterval = setPingInterval(this.#ws);

		this.#ws.addEventListener('message',  msg=>{
			const {from, channelId, data} = JSON.parse(msg.data);
			switch (data.type) {
				case 'offer':
					if(this.#peers[channelId]) {
						// offer resulted from renegotiate sent by this existing peer
						this.#peers[channelId].signal(data);
 					} else {
						// new offer requirung 
						this.emit('offer', data, from, channelId);
					}
					break;
	
				case 'candidate':
				case 'answer':
				case 'renegotiate':
					if(data.type == 'answer'){
						clearTimeout(this.#peers[channelId]?.offerTimer);
					}
					if(this.#peers[channelId])
						this.#peers[channelId].signal(data);
					break;

				case 'peerError':
					this.#peers[channelId].emit('peerError', data);
					break;

				default:
					this.emit('error', {code: 'EUNKNOWNMSG', message: `Unknown message from peer or Brume server: ${data.type}`});;
					break;
			}
		});

		this.#ws.addEventListener('close', (event) => {

			if(this.listeners('serverclose').length == 0) {
				setTimeout(async ()=>{ await this.start(); }, 10*1000);  //give server time to delete closed session
			} else {
				this.emit('serverclose');
			}

			clearInterval(pingInterval);
			this.stop();
		});
	};

	get thisUser() { return this.#user; }
	set onconnection(func){ this.#offerProcessor = func; }

	start(config = undefined){ // browser Brume doesn't have config until start
		if(config){
			this.#config = config;
			this.#user = jwt.decode(config.token)['custom:brume_name'];
		}
		return new Promise(async (res, rej) => {
			try {
				let peer = undefined;
				await this.#openWs({token: this.#config.token, url: this.#config.url});

				this.addListener('offer', async (offer, from, channelId)=>{
					peer = new SimplePeer({channelId, trickle: false, ...(typeof wrtc != 'undefined' ? {wrtc} : {})});
					this.#peers[channelId] = peer;
					peer.channelId = channelId;
					peer.peerUsername = from;
			
					peer.on('signal', data => {
						const msg = data.candidate ? {type: 'candidate', candidate: data} : {type: data.type, data};
						msg.channelId = peer.channelId;
						this.#ws.send(JSON.stringify({ action: 'send', to: from, data: msg }));
					});
			
					peer.on('error', (e) => { rej(e); });
					peer.on('close', () => { delete this.#peers[peer.channelId]; });
					let rVal = { // use instead of peer for offerProcessor
						peer,
						async accept(){
							peer.signal(offer);
							return await new Promise(res => { peer.on('connect', ()=>{ res(); }); });
						}
					};
					await this.#offerProcessor ? this.#offerProcessor(rVal) : this.#connectionQ.send(rVal);
				});
				res();
			} catch(e) {
				if(e?.code && e.code == '401'){
					try{
						let {IdToken} = await refreshTokenAuth(CLIENTID, this.#config.RefreshToken);
						this.#config.token = IdToken;
						this.emit('reauthorize', this.#config);
						await this.#openWs({token: this.#config.token, url: this.#config.url});
						res(this);				
					} catch(e) {
						rej(e);
					}
				} else {
					rej(e);
				}
			}
		});
	}

	stop(){ this.#ws = null; }

	async connection(){
		if(this.#offerProcessor) return null;
		try{ return await this.#connectionQ.get(); }
		catch(e){ return null; }
	}
	
	async connect(dest){
		const peer = new SimplePeer({initiator: true, trickle: false, ...(typeof wrtc != 'undefined' ? {wrtc} : {})});
		peer.peerUsername = dest;
		peer.channelId = this.#user + Math.random().toString(10).slice(2,8);
		this.#peers[peer.channelId] = peer;
		try{
			return await new Promise((res, rej) => {
				peer.on('signal', data => {
					const msg = data.candidate ? {type: 'candidate', candidate: data} : {type: data.type, data};
					msg.channelId = peer.channelId;
					peer.offerTimer = setTimeout(()=>{
						peer.emit('peerError', { code: "EOFFERTIMEOUT", peerUsername: dest });
						delete this.#peers[peer.channelId];
					}, OFFERTIMEOUT);
					this.#ws.send(JSON.stringify({ action: 'send', to: dest, data: {channelId: peer.channelId, data} }));
				});

				peer.on('connect', () => { res(peer); });
				peer.on('error', (e) => { rej(e); });
				peer.on('peerError', ({code, peerUsername}) => {
					clearTimeout(peer.offerTimer);
					delete this.#peers[peer.channelId];
					rej({code: code, peerUsername, type: 'peerError', message: `${peerUsername} connection request timeout`});
				});

				peer.on('close', () => { delete this.#peers[peer.channelId]; });
			});
		} catch(e) {
			throw(e);
		}
	};
}
