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
		
		browser.storage.local.get("searchObject_last_mod").then((result) => {
			if (result.searchObject_last_mod === undefined) {
				result.searchObject_last_mod = Date.now();
				console.log("No searchObject_last_mod in localStorage. Creating...");
			}
			if (result.searchObject_last_mod === response.last_mod) {
				console.log("Same modification time. Doing nothing...");
				return false;
			} 
			if (response.base64 === undefined || response.last_mod === undefined) {
				console.err("Bad native message");
			}

			console.log('Parsing native message');
			
			let searchObject = readMozlz4Base64String(response.base64);
			
			console.log(searchObject);
			
			browser.storage.local.set({'searchObject': searchObject});
			browser.storage.local.set({'searchObject_last_mod': response.last_mod});
			
			let saveTo = searchEngineObjectToArray(searchObject.engines);
			
			var icons = loadRemoteIcons(saveTo);
			var timeout_start = Date.now();
			var timeout = 15000;

			var remoteIconsInterval = setInterval(function() {
				
				function onSet() {				
					userOptions.searchEngines = saveTo;
					browser.storage.local.set({'userOptions': userOptions});
					getAllOpenTabs((tabs) => {
						for (let tab of tabs)
							browser.tabs.sendMessage(tab.id, {"userOptions": userOptions});	
					});
					clearInterval(remoteIconsInterval);
				}
				
				var counter = 0;
				for (var i=0;i<icons.length;i++) {
					if (typeof icons[i].base64String !== 'undefined') {
						saveTo[i].icon_base64String = icons[i].base64String;
						counter++;
					}
				}
				
				if (Date.now() - timeout_start > timeout ) {
					console.log('timeout loading remote icons');
					onSet();
				}
				
				if (counter === icons.length) {
					onSet();
				}
			
			}, 250);
			
		});
	}

	function onError(error) {
		console.log(`Error: ${error}`)
	}

	var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"path": "' + userOptions.searchJsonPath.replace(/\\/g, "/") + '"}');
	sending.then(onResponse, onError);

}

if (typeof browser.runtime.sendNativeMessage === 'function') {
	browser.tabs.onActivated.addListener((tab) => {
		nativeApp();
	});
}