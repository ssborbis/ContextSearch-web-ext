var userOptions;
var typeTimer = null;

browser.runtime.sendMessage({action: "getUserOptions"}).then((message) => {
	userOptions = message.userOptions || {};
	
	if ( userOptions === {} ) return;
		
	let sb = document.getElementById('quickmenusearchbar');
	sb.placeholder = browser.i18n.getMessage('Search');
	
	let qm = document.createElement('div');
	qm.id = 'quickMenuElement';
	
	let suggest = document.getElementById('suggestions');
	
	sb.onkeypress = function(e) {
		clearTimeout(typeTimer);
		typeTimer = setTimeout(() => {
			if (!sb.value.trim()) {
				suggest.style.maxHeight = null;
				return;
			}
			suggest.style.maxHeight = '100px';
			console.log('fetching suggestions');
			suggest.innerHTML = null;
			getSuggestions(sb.value, (xml) => {
				for (s of xml.getElementsByTagName('suggestion')) {
					let div = document.createElement('div');
					div.onclick = function() {
						let selected = suggest.querySelector('.selectedFocus');
						if (selected) selected.classList.remove('selectedFocus');
						this.classList.add('selectedFocus');
						sb.value = this.innerText;
					}
					
					div.ondblclick = function() {
						var e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, keyCode: 13});
						sb.dispatchEvent(e);
					}
					div.innerText = s.getAttribute('data');
					
//					div.innerHTML = div.innerText.replace(sb.value, "<b>" + sb.value + "</b>");
					suggest.appendChild(div);
				}
			})
		}, 250);
	}
	
	sb.onkeydown = function(e) {
		if (e.keyCode === 13) {
			
			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: sb.selectedIndex || 0,
					selectionText: sb.value,
					openMethod: "openNewTab"
				}
			});

		}
	}
	
	sb.addEventListener('keydown', (e) => {
		if (e.keyCode === 37 || e.keyCode === 38 || e.keyCode === 39 ||e.keyCode === 40 || e.keyCode === 9) {
			
			e.preventDefault();

			let direction = 0;
			if (e.keyCode === 9 && !e.shiftKey)
				direction = 1;
			else if (e.keyCode === 9 && e.shiftKey)
				direction = -1;
			else if (e.keyCode === 40)
				direction = 6;
			else if (e.keyCode === 38)
				direction = -6;
			else if (e.keyCode === 39)
				direction = 1; 
			else if (e.keyCode === 37)
				direction = -1;

			let divs = quickMenuElement.querySelectorAll('div[data-index]');
			
			if (sb.selectedIndex !== undefined) divs[sb.selectedIndex].classList.remove('selectedFocus');
			
			if (sb.selectedIndex === undefined)
				sb.selectedIndex = 0;
			else if (sb.selectedIndex + direction === divs.length && e.keyCode === 9)
				sb.selectedIndex = 0;
			else if (sb.selectedIndex + direction < 0 && e.keyCode === 9)
				sb.selectedIndex = divs.length -1;
			else if (sb.selectedIndex + direction >= divs.length)
				;
				//sb.selectedIndex = userOptions.quickMenuColumns - (divs.length - sb.selectedIndex);
			else if (sb.selectedIndex + direction < 0)
				;
				//sb.selectedIndex = divs.length - userOptions.quickMenuColumns - sb.selectedIndex;
			else
				sb.selectedIndex+=direction;
			
			let se = userOptions.searchEngines[sb.selectedIndex];
			document.getElementById('searchEngineTitle').innerText = se.title;

			divs[sb.selectedIndex].classList.add('selectedFocus');
		}
	});
	
	let sb_width = 300;
	let columns = 6;
	div_width = sb_width / columns;

	for (let i=0;i<userOptions.searchEngines.length;i++) {
		
		let se = userOptions.searchEngines[i];
		
		let div = document.createElement('div');
		
		div.style.width = div_width + "px";
	
		div.style.backgroundImage = "url(" + se.icon_base64String || se.icon_url + ")";
//		div.style.backgroundSize = 16 * userOptions.quickMenuIconScale + "px";
		div.index = i;
		div.dataset.index = i;
		div.title = se.title;
		
		div.onclick = function() {

			browser.runtime.sendMessage({
				action: "quickMenuSearch", 
				info: {
					menuItemId: div.index,
					selectionText: sb.value,
					openMethod: "openNewTab"
				}
			});
		};
		
		div.onmouseenter = function() {
			document.getElementById('searchEngineTitle').innerText = se.title;
		}
		div.onmouseleave = function() {
			document.getElementById('searchEngineTitle').innerText = ' ';
		}
		qm.appendChild(div);
		
		if ( (i + 1) % columns === 0) {
			let br = document.createElement('br');
			qm.appendChild(br);
		}
	}
	
	document.body.appendChild(qm);
	
	let div = document.createElement('div');
	div.style = 'text-align:center;border-top:1px solid #e0e0e0';
	div.className = 'hover';
	let img = document.createElement('img');
	img.src = "/icons/settings.png";
	img.style.height = '16px';
	img.style.padding = '8px';

	div.onclick = function() {
		document.body.style.visibility = 'hidden';
		location.href = browser.runtime.getURL('/options.html#browser_action');
	}
	
	document.getElementById('searchEngineTitle').style.width = parseFloat(window.getComputedStyle(qm).width) - 10 + "px";
	
	div.appendChild(img);

	document.body.appendChild(div);
	sb.focus();
	
	function getSuggestions(terms, callback) {
		
		let url = 'http://suggestqueries.google.com/complete/search?output=toolbar&hl=' + browser.i18n.getUILanguage() + '&q=' + encodeURIComponent(terms);
		callback = callback || function() {};
		var xmlhttp;

		xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = function()	{
			if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
				if(xmlhttp.status == 200) {

					let parsed = new DOMParser().parseFromString(xmlhttp.responseText, 'application/xml');
					
					if (parsed.documentElement.nodeName=="parsererror") {
						console.log('xml parse error');
						
						console.log(parsed);
						parsed = false;
					}
					callback(parsed);
			   } else {
				   console.log('Error fetching ' + url);
			   }
			}
		}
		
		xmlhttp.ontimeout = function (e) {
			console.log('Timeout fetching ' + url);
			callback(false);
		};

		xmlhttp.open("GET", url, true);
		xmlhttp.timeout = 500;
		xmlhttp.send();
	}

});