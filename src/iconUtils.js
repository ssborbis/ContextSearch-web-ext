function uncacheIcons() {

	for ( let se of userOptions.searchEngines ) {

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
				let data = await imageToBase64(img, userOptions.cacheIconsMaxSize); 

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

async function findFavicons(url) {
	let tab;
	try {

		tab = await browser.tabs.create({url:url, active:false});

		let hrefs = await browser.tabs.executeScript(tab.id, {
			code: `
			    var hrefs = [];
				document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel^="apple-touch-icon"]').forEach( l => hrefs.push(l.href));
				hrefs;
			`
		});

		hrefs = hrefs.shift();

		try {
			let _url = new URL(url);
			hrefs.unshift(_url.origin + "/favicon.ico");
		} catch(error) {};

		if ( tab ) browser.tabs.remove(tab.id);

		return hrefs;
	} catch (error) {
		if ( tab ) browser.tabs.remove(tab.id);
		return [];
	}
}

function findFaviconsWrapper(url) {
	let promise1 = findFavicons(url);
	let promise2 = new Promise(r => setTimeout(() => r([]),5000));

	return Promise.race([promise1, promise2]);
}

// options.html
$('#faviconFinder').onclick = async function() {

	let form = $('#editSearchEngineContainer');

	let url;
	try {
		url = new URL(form.searchform.value || form.template.value);
	} catch( error ) {
		return;
	}

	let urls = await findFaviconsWrapper(url.origin);

	// include the current icon URI in the picker
	if ( form.iconURL.value && !urls.includes(form.iconURL.value))
		urls.push(form.iconURL.value);

	if ( !urls.length ) return;

	let overdiv = document.createElement('div');
	overdiv.style = "position:fixed;left:0;right:0;top:0;bottom:0;background-color:#0008;z-index:9999";
	let div = document.createElement('div');
	div.id = "faviconPickerContainer";
	overdiv.appendChild(div);
	document.body.appendChild(overdiv);

	urls.forEach( _url => {

		let box = document.createElement('div');
		box.className = "faviconPickerBox";

		let img = new Image();
		img.src = _url;

		img.onload = function() {
			let label = document.createElement('div');
			label.innerText = this.naturalWidth + " x " + this.naturalHeight;
			box.appendChild(label);
		}

		img.onerror = function() {
			box.parentNode.removeChild(box);
		}

		box.appendChild(img);
		div.appendChild(box);

		box.onclick = function() {
			form.iconURL.value = img.src;
			form.save.click();
		}
	})

	overdiv.onclick = function(e) {
		overdiv.parentNode.removeChild(overdiv);
	}

}
