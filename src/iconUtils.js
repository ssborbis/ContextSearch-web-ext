function uncacheIcons() {

	for ( let se of findNodes(userOptions.nodeTree, n => n.iconCache) ) {

		let hasDataURI = se.iconCache.startsWith('data:');
		let isDataURI = se.icon.startsWith("data:");
		let hasURL = se.icon.startsWith("http");

		if ( hasURL && hasDataURI) {
			console.log(se.title + " cache will be cleared");
			se.iconCache = "";
			continue;
		}

		if ( hasDataURI && isDataURI && hasDataURI == isDataURI ) {
			console.log(se.title + " duplicate data URIs. Removing cache");
			se.iconCache = "";
			continue;
		}

		if ( isDataURI )
			console.warn(se.title + " has no URL");
	}
}

class IconCacher {
    constructor(tree, options = {}) {
        this.tree = tree;

        this.maxTimeout = options.maxTimeout ?? 10000;
        this.iconSize = options.iconSize ?? 32;

        this.nodes = findNodes(tree, node => node.icon);

        this.total = this.nodes.length;
        this.count = 0;
        this.success = 0;
        this.failed = 0;

        this.lastMessage = "";
        this.bad = [];

        this.oncomplete = options.oncomplete ?? (() => {});

        this._completed = false;
    }

    /**
     * Start caching all icons.
     *
     * @returns {Promise<IconCacher>}
     */
    async cache() {
        if (this.total === 0) {
            this._complete();
            return this;
        }

        await Promise.all(
            this.nodes.map(node => this._cacheIcon(node))
        );

        this._complete();

        return this;
    }

    /**
     * Cache a single icon.
     */
    _cacheIcon(node) {
        return new Promise(resolve => {
            const img = new Image();

            let finished = false;

            const finish = (success, error = null) => {
                // Prevent timeout/load/error from completing the same
                // node more than once.
                if (finished) {
                    return;
                }

                finished = true;

                clearTimeout(timeout);

                if (success) {
                    this.success++;
                    this.lastMessage = node.title ?? "";
                } else {
                    this.failed++;

                    this.bad.push({
                        engine: node,
                        error
                    });
                }

                this.count++;

                resolve();
            };

            const timeout = setTimeout(() => {
                // Cancel the request.
                img.onload = null;
                img.onerror = null;
                img.src = "";

                finish(false, "TIMEOUT");
            }, this.maxTimeout);

            img.onload = async () => {
                try {
                    const isDataURI = node.icon.startsWith("data:");

                    // Small data URIs can be used directly.
                    if (
                        isDataURI &&
                        img.naturalWidth <= this.iconSize &&
                        img.naturalHeight <= this.iconSize
                    ) {
                        finish(true);
                        return;
                    }

                    const data = await imageToBase64(
                        img,
                        this.iconSize
                    );

                    if (data) {
                        node.iconCache = data;
                        finish(true);
                    } else {
                        finish(false, "BAD_ENCODE");
                    }
                } catch (error) {
                    finish(false, error?.message ?? "ENCODE_ERROR");
                }
            };

            img.onerror = () => {
                finish(false, "LOAD_ERROR");
            };

            img.src = node.icon;
        });
    }

    /**
     * Called once after every icon has finished.
     */
    _complete() {
        if (this._completed) {
            return;
        }

        this._completed = true;
        this.oncomplete(this);
    }

    /**
     * Reset state so the cache can be run again.
     */
    reset() {
        this.count = 0;
        this.success = 0;
        this.failed = 0;

        this.lastMessage = "";
        this.bad = [];

        this._completed = false;

        return this;
    }
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
