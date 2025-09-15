export class ContextSearchWindow{
	constructor (o = {}) {
		this.iframe = document.createElement('iframe');
		this.iframe.id = o.id || gen();
		this.iframe.style.opacity = 0;
		this.iframe.style.width = "0px";

		this.iframe.setAttribute('allow', "clipboard-read; clipboard-write");

		this.iframe.style.setProperty('--cs-custom-scale', o.scale || 1);

		this.iframe.allowTransparency = true;
	}

	add = () => {
		getShadowRoot().appendChild(this.iframe);
	}

	remove = () => {
		getShadowRoot().removeChild(this.iframe);
	}
}