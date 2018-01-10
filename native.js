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
		
		if (response.error) {
			console.error(response.error);
			return false;
		}
		
		browser.storage.local.get("searchObject_last_mod").then((result) => {
			if (result.searchObject_last_mod === undefined) {
				result.searchObject_last_mod = Date.now();
				console.log("No searchObject_last_mod in localStorage. Creating...");
			}
			
			if (result.searchObject_last_mod === response.last_mod) return false;

			browser.runtime.sendNativeMessage("ContextSearch",'{"path": "' + userOptions.searchJsonPath + '"}').then((response) => {
				
				if (response.error) {
					console.error(response.error);
					return false;
				}
				
				if (!response.base64) {
					console.error("Bad message. No base64 data");
					return false;
				}

				console.log('Parsing native message');
				let searchObject = readMozlz4Base64String(response.base64);
				
				console.log(searchObject);
				
				browser.storage.local.set({'searchObject_last_mod': response.last_mod});
				
				let se = searchEngineObjectToArray(searchObject.engines);
				loadRemoteIcons({
					searchEngines: se,
					callback: (details) => {
						userOptions.searchEngines = details.searchEngines;
						browser.storage.local.set({'userOptions': userOptions});
						getAllOpenTabs((tabs) => {
							for (let tab of tabs)
								browser.tabs.sendMessage(tab.id, {"userOptions": userOptions});	
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
			var gettingPage = browser.runtime.getBackgroundPage();
			gettingPage.then((page) => {
				page.nativeAppActive = false;
			});
		},2500);
	}
	
	var gettingPage = browser.runtime.getBackgroundPage();
	gettingPage.then((page) => {
		if (page.nativeAppActive) console.log('throttled');
		if (page.nativeAppActive) return false;
			
		page.nativeAppActive = true;
		
		var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + userOptions.searchJsonPath + '"}');
		sending.then(onResponse, onError);
	});
	
//	browser.runtime.sendNativeMessage("ContextSearch",'{"request": "%version%"}').then((response) => {
//	console.log(response);
//});

}

if (typeof browser.runtime.sendNativeMessage === 'function') {
	browser.tabs.onActivated.addListener((tab) => {
		nativeApp();
	});
}