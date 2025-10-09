function uncacheIcons() {

	for ( let se of findNodes(userOptions.nodeTree, n => n.type === 'searchEngine') ) {

		let hasDataURI = se.icon_base64String.startsWith('data:');
		let isDataURI = se.icon_url.startsWith("data:");
		let hasURL = se.icon_url.startsWith("http");

		if ( !se.icon_base64String) continue;

		if ( hasURL && hasDataURI) {
			console.log(se.title + " cache will be cleared");
			se.icon_base64String = "";
			continue;
		}

		if ( hasDataURI && isDataURI && hasDataURI == isDataURI ) {
			console.log(se.title + " duplicate data URIs. Removing cache");
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
		total: findNodes(userOptions.nodeTree, n => n.icon).length,
		oncomplete: function() {},
		cache: cache
	};

	function onError(se, reason) {
		result.bad.push({ engine: se, error: reason });
		result.count++;
	}

	function cache() {

		for (let se of findNodes(userOptions.nodeTree, n => n.icon)) {


			let isDataURI = se.icon.startsWith("data:");
			let hasURL = se.icon.startsWith("http");

			let img = new Image();

			let timeout = setTimeout(() => {
				img.src = null;
				onError(se, "TIMEOUT");
			},10000);

			img.onload = async function() {

				if ( isDataURI && ( img.naturalHeight <= userOptions.cacheIconsMaxSize && img.naturalWidth <= userOptions.cacheIconsMaxSize)) {
					clearTimeout(timeout);
					result.last_message = se.title;
					result.count++;
					onloadend();
					return;
				}
				let data = await imageToBase64(img, userOptions.cacheIconsMaxSize); 

				if ( data != "" ) {
					se.iconCache = data;
					result.last_message = se.title; 
					result.count++;
				}
				else onError(se, "BAD_ENCODE");

				clearTimeout(timeout);
				onloadend();
			}

			img.onerror = function() {
				onError(se, "LOAD_ERROR");
				clearTimeout(timeout);
				onloadend();
			}

			let onloadend = function() {
				if ( result.count >= result.total )
					result.oncomplete();
			}

			img.src = se.icon;
		}
	}

	return result;
}

function getHeaderFavicons() {
	var hrefs = [];
	document.querySelectorAll('link[rel^="apple-touch-icon"]').forEach( l => hrefs.push(l.href));
	document.querySelectorAll('link[rel="shortcut icon"]').forEach( l => hrefs.push(l.href));
	document.querySelectorAll('link[rel="icon"]').forEach( l => hrefs.push(l.href));
	//document.querySelectorAll('meta[property="og:image"]').forEach( m => hrefs.push(m.content));
	return hrefs;
}

async function findFavicons(url) {
	let tab;
	let hrefs = [];
	try {

		let promise1 = new Promise(resolve => {
			setTimeout(() => resolve(browser.tabs.remove(tab.id)),5000);
		});
		let promise2 = browser.tabs.create({url:url, active:false});

		tab = await Promise.race([promise1, promise2]);

		if ( !tab ) return [];

		// chrome requires a delay
		await new Promise(r => setTimeout(r, 500));

		const promise3 = _executeScript({
			func: getHeaderFavicons,
			tabId: tab.id
		})

		let promise4 = new Promise(resolve => setTimeout(resolve,5000));

		hrefs = await Promise.race([promise3, promise4]);

		try {
			let _url = new URL(url);
			hrefs.unshift(_url.origin + "/favicon.ico");
		} catch(error) {}

	} catch (error) {
		console.log(error);
	} finally {
		if ( tab ) browser.tabs.remove(tab.id);
		return hrefs || [];
	}
}
