# <img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/src/icons/icon48-2.png" height="30px">&nbsp;ContextSearch web-ext

Load your current search engines into a context menu for easily searching selected text. FF 57+ compatible. Originally written as a replacement for Ben Basson's Context Search.

Big thanks to [CanisLupus](https://github.com/CanisLupus) for his mozlz4 decompression script

## Features ###
* Context menu
* Popup menu with several opening methods
* Highlight search terms
* Custom Find bar with regex support
* Folders and subfolders for organizing search engines
* Bookmarklets support for user scripts
* Lite / Dark themes
* Custom user CSS for menus
* Site search support
* Reverse image search support
* International character coding for non-UTF-8 engines
* Built-in tools
* Easily add new engines from website search forms

___

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/firefox.png" width="80px">&nbsp;&nbsp;&nbsp;&nbsp;[Download @ Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/contextsearch-web-ext/) 

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/chrome.png" width="80px">&nbsp;&nbsp;&nbsp;&nbsp;[Download @ Chrome Store](https://chrome.google.com/webstore/detail/contextsearch-web-ext/ddippghibegbgpjcaaijbacfhjjeafjh)


## Building from source / sideloading
Replace `manifest.json` with `chrome_manifest.json` or `firefox_manifest.json` depending on which browser you are using.

___

## Quick Start
ContextSearch web-ext comes preloaded with some of the most popular search engines. No setup required.

## Search Using the Context Menu
* Select some text and right-click to bring up the context menu
* Expand the menu item <img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/src/icons/icon48.png" height="12pt">` Search for ... `and click the desired search engine from the list that appears.

The search results can be displayed in a number of ways depending on the key held while clicking the search engine.

Defaults:
  * `Click  -> Open In New Tab`
  * `Click + Shift -> Open In New Window`
  * `Click + Ctrl  -> Open In Background Tab`
  
These settings can be customized from `ContextSearch web-ext Options -> Context Menu -> Search Actions`

## Search Using the Quick Menu
The Quick Menu is a robust popup menu that can be used to perform search actions not available to the context menu

* Select text and hold down the right mouse button until the menu appears
* Click the icon for the desired search engine

The search results can be displayed in a number of ways depending on the button used or key held while clicking the search engine.

Defaults:
  * `Left Click  -> Open In New Tab`
  * `Middle Click  -> Open In Background Tab`
  * `Right Click  -> Open In Current Tab`
  * `Click + Shift -> Open In New Window`
  * `Click + Ctrl  -> Open In Background Tab`
  * `Click + Alt -> Keep Menu Open`
  
These settings can be customized from `ContextSearch web-ext Options -> Quick Menu -> Search Actions`

## Adding Search Engines
Most websites that have an embeded search bar can be added to the list of search engines in ContextSearch web-ext using the Add Custom Search option from the context menu.

* Open the website you want to add a search engine for
* Right-click on the search bar in the page to open the context menu
* Select the menu item `Add to ContextSearch` to open the Add Custom Search dialog box
* Click Add

---

## Highlighting Searched Words
After performing a search, search terms in the results page can be highlighted. The highlight styling and behaviour can be found in CS Options -> Highlight

Highlighting can be removed from a page by pressing ESC

## Modifying Search Terms
Each search engine's handling of the query string can be modified with the `Search Regex` field. The format should be a well-formed array in the following order:

`FIND_REGEX, REPLACE_REGEX [, REGEX_MODIFIERS]`

Some search engines require `+` instead of spaces. In this case, to change a query from `this is a search` to `this+is+a+search` the Search Regex would be `"\\s","+"`. Note the use of quotes and the need to escape the backslash. A literal backslash would require four backslashes `\\\\`

Regex can be chained using one regex replacement per line in the Search Regex field.

## Javascript-Driven Search Engines
Some websites use search bars that do not offer a GET or POST query, instead relying on web forms and javascript to perform a query. For these engines, the template should exclude `{searchTerms}` and instead, users can rely on the Search Code field. This field allows users to write javascript code to be executed after the GET or POST query is performed. For most javascript-driven engines, this means setting the search template to the URL of the website's search form and using DOM and CSS selectors to fill in the search form and simulate a submit.

For a simple example, if somewebsite.com used a javascript-driven search form, we could perform the search by using the Search Code field like this

* Name: Some Website Search Engine
* Template: https://somewebsite.com
* Method: **GET**
* POST params: *empty*
* Search Code:
```
let input = document.querySelector('input');
input.value = searchTerms;
input.dispatchEvent(new KeyboardEvent('keydown', {keyCode:13, key:"Enter"});
```

The search bar is assumed to be the first INPUT element which is filled in with the query string using the CS variable `searchTerms` and the Enter key is simulated.

## Search Engines Requiring Logins and Tokens
The same approach as the Javascript-Driven Search Engines above my be used to bypass session-based tokens and logins, provided the user is logged in using cookies or otherwise authenticated.
