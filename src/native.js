function nativeApp(options) {
	
	options = options || {
		force: false
	}
	
	if (options.force === undefined) options.force = false;
	
	if (userOptions.reloadMethod !== 'automatic') return false;
	
	if (typeof browser.runtime.sendNativeMessage !== 'function') return false;
		
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
		
		throttle();
		
		return browser.storage.local.get("searchObject_last_mod").then((result) => {
			if (result.searchObject_last_mod === undefined) {
				result.searchObject_last_mod = Date.now();
				console.log("native app: No searchObject_last_mod in localStorage. Creating...");
			}
			
			if (
				result.searchObject_last_mod === response.last_mod 
				&& options.force === false
			) return false;

			browser.browserAction.setIcon({path: "icons/spinner.svg"});
			
			return browser.runtime.sendNativeMessage("ContextSearch",'{"path": "' + userOptions.searchJsonPath + '"}').then((response) => {
				
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
				
				let searchEngines = searchJsonObjectToArray(searchObject.engines);
				
				// start 1.3.2+
				let old_names = [];
				for (let se of userOptions.searchEngines) {
					old_names.push(se.title);
				}
				
				let newEngines = [];
				for (let se of searchEngines) {
					if (!old_names.includes(se.title)) {
						newEngines.push(se);
					}
				}
				// end 1.3.2+
				
				if ( newEngines.length === 0 ) return false;
				
				return new Promise(function(resolve, reject) {
					loadRemoteIcons({
						searchEngines: newEngines, // 1.3.2+
						callback: (details) => {
							hideSearchEngines(details.searchEngines).then((_result) => {
								
								if (_result) searchEngines = userOptions.searchEngines.concat(_result);
								console.log("New Search Engines ->");
								console.log(_result);
								userOptions.searchEngines = searchEngines;
								
								notify({action: "saveUserOptions", userOptions: userOptions});
								notify({action: "updateUserOptions"});
								resolve(true);
							});
						}
					});
				});

			});

		});

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
	
//	console.log('native app: Request file mod time');
	var sending = browser.runtime.sendNativeMessage("ContextSearch",'{"!@!@": "' + userOptions.searchJsonPath + '"}');
	return sending.then(onResponse, onError);

//	browser.runtime.sendNativeMessage("ContextSearch",'{"request": "%version%"}').then((response) => {
//	console.log(response);
//});

}

function readHiddenEngines() {
		return browser.runtime.sendNativeMessage("ContextSearch",'{"path": "' + userOptions.searchJsonPath.replace("search.json.mozlz4", "prefs.js") + '"}').then((response) => {
				
		console.log('native app: Request file prefs.js');
		
		if (response.error) {
			console.error(response.error);
			return "";
		}
		
		if (!response.base64) {
			console.error("native app: Bad message. No base64 data");
			return "";
		}

		console.log('native app: Received file prefs.js');
		
		function u_atob(ascii) {
			return Uint8Array.from(atob(ascii), c => c.charCodeAt(0));
		}

		let prefs = new TextDecoder().decode(u_atob(response.base64));
		
		for (let line of prefs.split('\n')) {
			if (line.match(/^user_pref\("browser.search.hiddenOneOffs/)) {
	
				let regstr =/user_pref\("browser.search.hiddenOneOffs",\s*"(.*?)"\);/g;
				var match = regstr.exec(line);
				if (!match) continue;
				
				return match[1];
			}
		}
		
		return "";

	});
}

function hideSearchEngines(searchEngines) {

	return readHiddenEngines().then((result) => {
		if (!result || typeof result !== 'string') return searchEngines;
		let names = result.split(",");

		for (let i=searchEngines.length -1;i>-1;i--) {
			
			if (names.includes(searchEngines[i].title)) {
				searchEngines[i].hidden = true;
			}
		}
		
		return searchEngines;
	});
}

browser.tabs.onActivated.addListener((tab) => {
	nativeApp();
});

