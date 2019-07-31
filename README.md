<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/firefox.png" width="200px">

[Download @ Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/contextsearch-web-ext/)

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/chrome.png" width="200px">

[Download @ Chrome Store](https://chrome.google.com/webstore/detail/contextsearch-web-ext/ddippghibegbgpjcaaijbacfhjjeafjh)

___

# ContextSearch web-ext

Load your current search engines into a context menu for easily searching selected text. FF 57+ compatible. Written as a simple replacement for Ben Basson's Context Search.

Big thanks to [CanisLupus](https://github.com/CanisLupus) for his mozlz4 decompression script

### Quick Start
ContextSearch web-ext comes preloaded with some of the most popular search engines. No setup required.

#### Search using the context menu
* Select some text and right-click to bring up the context menu
* Expand the menu item <img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/src/icons/icon48.png" height="12pt">` Search for ... `and click the desired search engine from the list that appears.

The search results can be displayed in a number of ways depending on the key held while clicking the search engine.

Defaults:
  * Click  -> Open In New Tab
  * Click + Shift -> Open In New Window
  * Click + Ctrl  -> Open In Background Tab
  
These settings can be customized from `ContextSearch web-ext Options -> Context Menu -> Search Actions`


#### Search using the Quick Menu
The Quick Menu is a robust popup menu that can be used to perform search actiosn not available to the context menu

* Select text and hold down the right mouse button until the menu appears
* Click the icon for the desired search engine

The search results can be displayed in a number of ways depending on the button used or key held while clicking the search engine.

Defaults:
  * Left Click  -> Open In New Tab
  * Middle Click  -> Open In Background Tab
  * Right Click  -> Open In Current Tab
  * Click + Shift -> Open In New Window
  * Click + Ctrl  -> Open In Background Tab
  * Click + Alt -> Keep Menu Open
  
These settings can be customized from `ContextSearch web-ext Options -> Quick Menu -> Search Actions`

#### Adding Search Engines
Most websites that have an embeded search bar can be added to the list of search engines in ContextSearch web-ext using the Add Custom Search option from the context menu.

* Open the website you want to add a search engine for
* Right-click on the search bar in the page to open the context menu
* Select the menu item `Add Custom Search` to open the Add Custom Search dialog box
* Click Add

### Building from source / sideloading
Replace `manifest.json` with `chrome_manifest.json` or `firefox_manifest.json` depending on which browser you are using.

