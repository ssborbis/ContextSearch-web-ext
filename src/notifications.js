function showNotification(options) {
	
	let msg = options.message;
	let icon = options.icon;
	
	let CS_notification = document.createElement('div');
	CS_notification.className = 'CS_notification';
	
	let img = new Image();
	img.src = browser.runtime.getURL('icons/alert.png');
	
	let content = document.createElement('div');
	content.className = 'content';
	content.innerText = msg;
	
	[img, content].forEach(el => CS_notification.appendChild(el));

	CS_notification.style.opacity = 0;
	document.body.appendChild(CS_notification);
	CS_notification.getBoundingClientRect();
	CS_notification.style.opacity = 1;
	CS_notification.getBoundingClientRect();
	setTimeout(() => {
		runAtTransitionEnd(CS_notification, ['opacity'], () => {
			document.body.removeChild(CS_notification);
			delete CS_notification;
		});
		
		CS_notification.style.opacity = 0;
	}, 3000);
	
	CS_notification.onclick = function() {
		document.body.removeChild(CS_notification);
		delete CS_notification;
	}
}