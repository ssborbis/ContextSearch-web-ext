function nativeApp() {
	
	function readMozlz4Base64String(str)
	{
		let input = Uint8Array.from(atob(str), c => c.charCodeAt(0));
		let output;
		let uncompressedSize = input.length*3;  // size estimate for uncompressed data!

		// Decode whole file.
		do {
			output = new Uint8Array(uncompressedSize);
			uncompressedSize = decodeLz4Block(input, output, 8+4);  // skip 8 byte magic number + 4 byte data size field
			// if there's more data than our output estimate, create a bigger output array and retry (at most one retry)
		} while (uncompressedSize > output.length);

		output = output.slice(0, uncompressedSize); // remove excess bytes

		let decodedText = new TextDecoder().decode(output);
		
		return JSON.parse(decodedText);
	}
	
	function onResponse(response) {
		
		console.log('native app: Received file mod time');
		
		if (response.error) {
			console.error(response.error);
			throttle();
			return false;
		}
		
		browser.storage.local.get("searchObject_last_mod").then((result) => {
			if (result.searchObject_last_mod === undefined) {
				result.searchObject_last_mod = Date.now();
				console.log("native app: No searchObject_last_mod in localStorage. Creating...");
			}
			
			if (result.searchObject_last_mod === response.last_mod) return false;

			browser.browserAction.setIcon({path: "icons/spinner.svg"});
			
			browser.runtime.sendNativeMessage("ContextSearch",'{"path": "' + userOptions.searchJsonPath + '"}').then((response) => {
				
				console.log('native app: Request file');
				
				if (response.error) {
					console.error(response.error);
					return false;
				}
				
				if (!response.base64) {
					console.error("native app: Bad message. No base64 data");
					return false;
				}

				console.log('native app: Received file');
				let searchObject = readMozlz4Base64String(response.base64);
				
				console.log(searchObject);
				
				browser.storage.local.set({'searchObject_last_mod': response.last_mod});
				
				let se = searchEngineObjectToArray(searchObject.engines);
				loadRemoteIcons({
					searchEngines: se,
					callback: (details) => {
						userOptions.searchEngines = details.searchEngines;
						browser.storage.local.set({'userOptions': userOptions}).then(() => {
							notify({action: "updateUserOptions", "userOptions": userOptions});
						});
					}
				});
			});
			
		});
		
		throttle();
	}

	function onError(error) {
		console.log(`Error: ${error}`);
		throttle();
	}
	
	function throttle() {
		setTimeout(()=> {
			browser.browserAction.setIcon({path: browser.runtime.getManifest().browser_action.default_icon});
			window.nativeAppActive = false;
			if (window.nativeAppQueue) {
				console.log('native app: executing queued request');
				nativeApp();
			}
		},1000);
	}

	if (!userOptions.searchJsonPath) {
		console.log('native app: userOptions.searchJsonPath empty');
		return false;
	}
	
	if (window.nativeAppActive) {
		
		//throttled but execute at least once more after
		window.nativeAppQueue = true;
		console.log('native app: throttled');
		return false;
	}

	// set active for throttling
	window.nativeAppActive = true;
	
	// clear the queue
	window.nativeAppQueue = false;
	
	console.log('native app: Request file mod time');
	var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + userOptions.searchJsonPath + '"}');
	sending.then(onResponse, onError);

//	browser.runtime.sendNativeMessage("ContextSearch",'{"request": "%version%"}').then((response) => {
//	console.log(response);
//});

}

if (typeof browser.runtime.sendNativeMessage === 'function') {
	browser.tabs.onActivated.addListener((tab) => {
		nativeApp();
	});
}