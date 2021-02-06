function uncacheIcons() {

	for ( let se of userOptions.searchEngines ) {

		let hasDataURI = se.icon_base64String.startsWith('data:');
		let isDataURI = se.icon_url.startsWith("data:");
		let hasURL = se.icon_url.startsWith("http");

		if ( hasURL && hasDataURI) {
			console.log(se.title + " cache will be cleared");
			se.icon_base64String = "";
			continue;
		}

		if ( isDataURI )
			console.warn(se.title + " has no URL");

	}
}

function cacheIcons() {
	var result = {
		count:0,
		last_message:"",
		bad: [],
		total: userOptions.searchEngines.length,
		oncomplete: function() {},
		cache: cache
	};

	function onError(se, reason) {
		result.bad.push({ engine: se, error: reason });
		result.count++;
	}

	function cache() {

		for (let se of userOptions.searchEngines) {
			let hasDataURI = se.icon_base64String.startsWith('data:');
			let isDataURI = se.icon_url.startsWith("data:");
			let hasURL = se.icon_url.startsWith("http");

			if ( isDataURI ) {
				onError(se, "DATA_URI");
				continue;
			}

			if ( !se.icon_url ) {
				onError(se, "NO_URL");
				continue;
			}
			let img = new Image();

			let timeout = setTimeout(() => {
				img.src = null;
				onError(se, "TIMEOUT");
			},10000);

			img.onload = async function() {
				let data = await imageToBase64(img, userOptions.cacheIconsMaxSize || 64); 

				if ( data != "" ) {
					se.icon_base64String = data;
					result.last_message = se.title;
					result.count++;
				}
				else onError(se, "BAD_ENCODE");

				clearTimeout(timeout);
			}

			img.onerror = function() {
				onError(se, "LOAD_ERROR");
				clearTimeout(timeout);
			}

			img.onloadend = function() {
				if ( result.count >= result.total )
					result.oncomplete();
			}

			img.src = se.icon_url;
		}
	}

	return result;
}

// async function displayChoices() {

// 	let fetch = new fetchIcons();
// 	fetch.fetch();

// 	let container = document.createElement('div');
// 	container.style = "padding:20px;position:fixed;z-index:99;left:0;right:0;margin:auto;width:800px;height:80%;top:100px;overflow-y:scroll;background-color:white;box-shadow:10px 10px 30px #0005";

// 	document.body.appendChild(container);

// 	let update = setInterval(() => {
// 		container.innerHTML = null;

// 		[...fetch.found].forEach( f => {

// 			// if ( f.icons.length < 2 ) return;
// 			let row = document.createElement("div");

// 			row.innerText = f.engine.title;

// 			f.icons.forEach( i => {
// 				let box = document.createElement('div');
// 				box.style = "vertical-align:middle;display:inline-block;width:64px;height:64px;border:2px solid gray";
// 				box.style.background = 'url(' + i + ") no-repeat center";

// 				row.appendChild(box);
// 				// let img = new Image();
// 				// img.src = i;
// 				// row.appendChild(img);
// 			});

// 			container.appendChild(row);
// 		});
// 	}, 1000)

// 	fetch.onComplete = function() {
// 		clearInterval(update);
// 		console.log(fetch);
// 	}
// }

// async function getLargestImg(imgUrls) {
// 	let promises = [];

// 	imgUrls.forEach( url => {
		
// 		promises.push(new Promise( (resolve, reject) => {
// 			let img = new Image();
// 			img.onload = function() {
// 				resolve(img);
// 			}
// 			img.onerror = function() { resolve(null) }
// 			img.src = url;
// 		}));
// 	});

// 	return Promise.all(promises).then(values => {

// 		values = values.filter(v => v !== null);
// 		if ( !values.length ) return;
// 		return values.reduce((a, b) => a.naturalWidth < b.naturalWidth ? b : a).src;
// 	})
// }

// function fetchIcons() {
// 	this.count = 0;
// 	this.found = [];
// 	this.onComplete = function(){}

// 	function equalUrls(url1, url2) {
// 		try {
// 			return new URL(url1).pathname === new URL(url2).pathname;
// 		} catch (err) {
// 			return false;
// 		}
// 	}

// 	function getIcons(tab, url) {

// 		return new Promise(resolve => {

// 			browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabInfo) {
// 				if ( tabId === tab.id && changeInfo.status === "complete" && equalUrls(tabInfo.url, url)) {
// 					browser.tabs.onUpdated.removeListener(listener);

// 					let icons = browser.tabs.executeScript(tabId, {
// 						code: `
// 						    var hrefs = [];
// 							document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel^="apple-touch-icon"]').forEach( l => hrefs.push(l.href));
// 							hrefs;
// 						`
// 					});

// 					resolve(icons);
// 				}
// 			});

// 			browser.tabs.update(tab.id, { url: url });	

// 		});
// 	}


// 	this.fetch = async () => {

// 		var tab = await browser.tabs.create({ url: "about:blank", active:false });
// 		for (let se of userOptions.searchEngines) {

// 			let hasDataURI = se.icon_base64String.startsWith('data:');
// 			let isDataURI = se.icon_url.startsWith("data:");
// 			let hasURL = se.icon_url.startsWith("http");

// 			if ( (isDataURI && hasDataURI) ) continue;

// 			let promise2 = new Promise( (resolve,reject) => {

// 				async function listener(tabId, changeInfo, tabInfo) {
// 					if ( tabId === tab.id && changeInfo.status === "complete" && equalUrls(tabInfo.url, se.searchForm)) {
// 						browser.tabs.onUpdated.removeListener(listener);

// 						let icons = browser.tabs.executeScript(tabId, {
// 							code: `
// 							    var hrefs = [];
// 								document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel^="apple-touch-icon"]').forEach( l => hrefs.push(l.href));
// 								hrefs;
// 							`
// 						});

// 						icons.then(result => {
// 							resolve(result);
// 						}, error => {
// 							console.log(error);
// 							resolve();
// 						});
// 					}
// 				}

// 				browser.tabs.onUpdated.addListener(listener);

// 				browser.tabs.update(tab.id, { url: se.searchForm }).then(_tab => tab = _tab, error => {
// 					browser.tabs.onUpdated.removeListener(listener);
// 					resolve();
// 				});

// 				setTimeout(() => {
// 					browser.tabs.onUpdated.removeListener(listener);
// 					resolve();
// 				}, 4000);
// 			});			

// 			let values = await promise2;

// 			console.log(values);
			
// 			if ( values && values.length ) this.found.push({engine: se, icons: values[0]});

// 		}

// 		this.completed = true;

// 		if ( tab ) browser.tabs.remove(tab.id);

// 		this.onComplete();
// 	}

// }