import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
export {userPassAuth, refreshTokenAuth};

const ClientId = '6dspdoqn9q00f0v42c12qvkh5l';
const REGION = 'us-east-1';
const client = new CognitoIdentityProviderClient({region: REGION});

async function userPassAuth(USERNAME, PASSWORD) {
	const params = {
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId,
		AuthParameters : {
			USERNAME,
			PASSWORD
		}
	};

	try {
		const command = new InitiateAuthCommand(params);
		let data = await client.send(command);
		if(data.ChallengeName && data.ChallengeName == "NEW_PASSWORD_REQUIRED"){
			return {error: "NEW_PASSWORD_REQUIRED"};
		} else {
			return {IdToken: data.AuthenticationResult.IdToken};
		}
	} catch(err){
		return {error: err};
	}
};

async function refreshTokenAuth(ClientId, REFRESH_TOKEN) {
	const params = { 
		ClientId,
		AuthFlow: "REFRESH_TOKEN_AUTH",
		AuthParameters: {REFRESH_TOKEN}
	};

	try {
		const command = new InitiateAuthCommand(params);
		const r = await client.send(command);
		return r.AuthenticationResult;
	} catch(e){
		throw(e);
	}
};
