"use strict";
(self["webpackChunkbrowserbrume"] = self["webpackChunkbrowserbrume"] || []).push([["brume-app_cognitoAuth_mjs"],{

/***/ "./brume-app/cognitoAuth.mjs":
/*!***********************************!*\
  !*** ./brume-app/cognitoAuth.mjs ***!
  \***********************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   refreshTokenAuth: () => (/* binding */ refreshTokenAuth),
/* harmony export */   userPassAuth: () => (/* binding */ userPassAuth)
/* harmony export */ });
/* harmony import */ var _aws_sdk_client_cognito_identity_provider__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @aws-sdk/client-cognito-identity-provider */ "./brume-app/node_modules/@aws-sdk/client-cognito-identity-provider/dist-es/CognitoIdentityProviderClient.js");
/* harmony import */ var _aws_sdk_client_cognito_identity_provider__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @aws-sdk/client-cognito-identity-provider */ "./brume-app/node_modules/@aws-sdk/client-cognito-identity-provider/dist-es/commands/InitiateAuthCommand.js");



const ClientId = '6dspdoqn9q00f0v42c12qvkh5l';
const REGION = 'us-east-1';
const client = new _aws_sdk_client_cognito_identity_provider__WEBPACK_IMPORTED_MODULE_0__.CognitoIdentityProviderClient({region: REGION});

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
		const command = new _aws_sdk_client_cognito_identity_provider__WEBPACK_IMPORTED_MODULE_1__.InitiateAuthCommand(params);
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
		const command = new _aws_sdk_client_cognito_identity_provider__WEBPACK_IMPORTED_MODULE_1__.InitiateAuthCommand(params);
		const r = await client.send(command);
		return r.AuthenticationResult;
	} catch(e){
		throw(e);
	}
};


/***/ })

}]);