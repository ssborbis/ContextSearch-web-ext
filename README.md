# <img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/src/icons/icon.svg" height="30px">&nbsp;ContextSearch web-ext

Add any search engine to your WebExtensions-compatible browser. Originally written as a replacement for Ben Basson's Context Search.

##### Table of Contents  
[Features](#features)  
[Building From Source](#building)  
Ways To Search  
* [Context Menu](#contextmenu)
* [Quick Menu](#quickmenu)
* [Toolbar Menu](#toolbarmenu)
* [Sidebar Menu](#sidebarmenu)
* [Page Tiles](#pagetiles)
* [Omnibox](#omnibox)
* [Hotkeys](#hotkeys)

[Highlighting Results](#highlighting)  
[Adding Engines](#addingengines)  
[Editing Engines](#editingengines)  
* [Modifying Terms](#modifyingterms)
* [Template Parameters](#templateparameters)
* [Javascript and Form-Based Engines](#javascriptengines)
* [Engines With Logins and Tokens](#loginsandtokens)

[Bookmarklets](#bookmarklets)  
[Styling](#styling)  

  
Big thanks to [CanisLupus](https://github.com/CanisLupus) for his mozlz4 decompression script

<a name="features"/>

## Features
* Works with any search engine.
* Context menu
* Popup menu with several opening methods
* Highlight search terms
* Custom Find bar with regex support
* Folders and subfolders for organizing search engines
* Bookmarklets support for user scripts
* Themes
* Custom user CSS for menus
* Site search support
* Reverse image search support
* International character coding for non-UTF-8 engines
* Built-in tools
* Easily add new engines from website search forms

___

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/firefox.png" width="80px">&nbsp;&nbsp;&nbsp;&nbsp;[Download @ Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/contextsearch-web-ext/) 

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/chrome.png" width="80px">&nbsp;&nbsp;&nbsp;&nbsp;[Download @ Chrome Store](https://chrome.google.com/webstore/detail/contextsearch-web-ext/ddippghibegbgpjcaaijbacfhjjeafjh)

<a name="building"/>

## Building from source / sideloading

The easiest way to build your own package is to install [web-ext](https://www.npmjs.com/package/web-ext)

Replace `manifest.json` with `chrome_manifest.json` or `firefox_manifest.json` depending on which browser you are using. Some browser forks may require modifications to the manifest to work. Waterfox Classic, for instance, requires the explicit `web_accessible_resources` section found in the generic manifest.json and `strict_min_version` to `"56.0"`

<a name="contextmenu"/>

## Context Menu

Display search engines in the context (right-click) menu.

### Usage
* Select some text and right-click to bring up the context menu
* Expand the menu item <img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/src/icons/icon48.png" height="12pt">` Search for ... `and click the desired search engine from the list that appears.

The search results can be displayed in a number of ways depending on the key held while clicking the search engine.

Defaults:
  * Click `Open In New Tab`
  * Click + Shift `Open In New Window`
  * Click + Ctrl `Open In Background Tab`

  These settings can be customized from `ContextSearch web-ext Options -> Context Menu -> Search Actions`

### Options

#### Enable "Add Custom Search / Add to ContextSearch"
An option to add new search engines will appear in the context menu when you right-click a text input element. If you're going to be adding engines, you want to keep this enabled.

#### Show an option to search the entire folder at the top of the menu
Each folder will display `<<Search All>>` as the first entry at the top of the folder contents. Click this will search all engines in the folder at once using the same search terms.

#### Recently Used
Display the most recently-used search engines at the top of the main folder. Optionally display them as a folder. Set the number / limit to display

#### Search Actions
Choose how different buttons / button + key combos will display the search results.

* Current Tab
* New Tab
* Background Tab
* New Window
* New Incognito Window
* Sidebar (Mozilla)

#### Shortcut
Some OS's allow a key to be used to jump to a particular context menu entry. If you use a keyboard to quickly navigate the context menu, this may be useful to set.

<a name="quickmenu"/>

## Quick Menu
The Quick Menu is a robust popup menu that can be used to perform search actions not available to the context menu

### Usage
* Select text and hold down the right mouse button until the menu appears
* Click the icon for the desired search engine

The search results can be displayed in a number of ways depending on the button used or key held while clicking the search engine.

Defaults:
  * Left Click `Open In New Tab`
  * Middle Click `Open In Background Tab`
  * Right Click `Open In Current Tab`
  * Click + Shift `Open In New Window`
  * Click + Ctrl `Open In Background Tab`
  * Click + Alt `Keep Menu Open`
  
These settings can be customized from `ContextSearch web-ext Options -> Quick Menu -> Search Actions`

### Options
| General |  |
|--- | --- |
| Enable on textarea and input elements | If you don't want the menu to open when you're working in a text field, uncheck this.
| Enable on links | Links can be treated as selected text and allow the menu to open. The search terms can be either the link URL or link text, depending on whether CTRL is held down. More options under the General tab.
|Enable on images | Links can be treated as selected text and allow the menu to open. The image URL will be used as the search terms. This can be useful for reverse-image searches.

| Layout | |
| --- | --- |
| Default View | Grid: Display search engines as small tiles in a grid layout with just icons<br>Text: Display search engines in a list with names shown <br><br>This setting can be changed with the menu open by using the Toggle Display tool or shortcut |
| Rows / Columns | Set the opening size of the menu. The initial size of grid and text modes can be set independently. |

| Size | |
| --- | --- |
| Menu Size | The menu scale can be adjusted for different resolutions. If you have a 4K monitor with no scaling, you may want to set this to a high value.
| Icon Size | A bit obsolete, but you can change the icon size in grid view to take up more of the tile. ( will probably be removed ) |

#### Opening
Pick what actions open the menu. You can use more than one
| | |
| --- | --- |
| Hide the default context menu when opening the Quick Menu using right-click | Somewhere between overkill and useless. Depending on the OS, you may be able to suppress the original context menu from opening if you're using the same mouse button to open the quick menu.|
| Auto | Menu opens immediately after selecting some text|
|Keyboard|Selecting text and pressing a key opens the menu|
|Mouse|Select text and click or hold a mouse button. Using the right-click / hold can get a bit weird and conflict with the default context menu on some browers / OS's, mostly Linux-based. The timeout for opening on Hold can be set in Advanced|
|Simple Click|Forget selecting text and just click a word. Probably best to set a modifier key (Alt, Ctrl, Shift) with it to avoid opening the menu all the time. Clicking between words will get you both.
|Drag|Select text and drag to open the menu. The tiles respond to drag & drop ( Mozilla ) so you can drag to open, drop to search. |

#### Closing
Optionally close the menu after clicking a search tile or by scrolling the mousewheel

#### Search Actions

Choose how different buttons / button + key combos will display the search results.

* Current Tab
* New Tab
* Background Tab
* New Window
* New Incognito Window
* Sidebar (Mozilla)

#### Position
The quick menu normall opens relative to the mouse cursor. Here you can adjust what side of the curosr it opens on and fine-tune the offset.

#### Tools
Along with your search engines, you can display some useful? tools for performing some common tasks.

###### Display Tools In a Separate Toolbar
If you don't want your tools mingling with your search engines, taking up space and whatnot, you can put them in their own toolbar. Scroll left / right using the mousewheel or by clicking the buttons that appear to the left or right of the menu if you have more tools than can be displayed.

###### Position
Show tools on the top or bottom of the quick menu, or hide them altogether
| | |
| --- | --- |
|Last Used|Show the last-used search engine to easily repeat a search|
|Copy|Copy the current search terms to the clipboard|
|Close|Close the menu|
|Disable Menu|This closes the menu and prevents it from opening again on the current tab session. Useful if the menu opens unwanted on a partiulcar page but you don't want to disable it everywhere.|
|Lock|Keep the menu open after performing a search and it stays in the same place. You can reposition it by dragging the menu bar.|
|Open As Link|If the selected text is thought to be an URL, this tool will become enabled. Click to navigate to the URL|
|Find In Page|Use the built-in Findbar to highlight words in the current page. See the [Highlight](#highlight) section for more info.|
|Grid / Text|oggle the menu display
|Options|Open the options page
|Next Theme|Cycle through some build-in themes for the menus. Find something you like.
|Edit|Put the menu into 'edit' mode to resize the layout or rearrange tiles. When editing, tiles can be dragged & dropped to re-order, and the lower-right corner of the menu can be dragged to resize and change the columns / rows count.
|Toggle Hotkeys|This one might get removed. Right now, it toggles whether search engine hotkeys can work when the quick menu does not have focus. Basically, turns on or off the ability to type a letter and perform a search. See [Hotkeys](#hotkeys) for more info.
|Instant Search / Repeat Search|Enabling this tool allows you to use whatever opening methods are enabled for the quick menu to perform a search using the last search engine used. <br>Confused?<br>Essentially, it can work like this. Say you're on a website and you're going look up many words / urls / images / whatever on the page using a particular search engine. Well, you could open the quick menu, lock it, perform a search using the engine you want, then turn on the Instant Search. Lets say you also enabled the quick menu opening method 'Simple Click'. Now you can just start clicking words in the webpage and get a bunch of search results in background tabs. If you do a LOT of searches on a particular page, this tool will save you time.|

#### Search Bar
You can optionally show a search bar in the quick menu. Search bars include a suggestions drop-down box that displays search history and Google suggestions ( optionally, see [General](#general) for more info)

###### Set focus to search bar when the Quick Menu is opened
Like to edit your search terms after opening the menu?

###### Select all text in the search bar when it receives focus
When used with 'Set focus...', the first thing you type replaces the search terms in the search bar. If you're using a shortcut to open the quick menu, not necessarily selecting text first, you may want to enable this to erase and replace the currently displayed search terms with a keystroke.

<a name="addingengines"/>

## Adding Search Engines
Most websites that have an embeded search bar can be added to the list of search engines in ContextSearch web-ext using the Add Custom Search option from the context menu.

* Open the website you want to add a search engine for
* Right-click on the search bar in the page to open the context menu
* Select the menu item `Add to ContextSearch` to open the Add Custom Search dialog box
* Click Add

You can also rename the engine and choose what folder to add the new engine to.

Clicking `Advanced` will show more options. 
* If the website provides an opensearch engine, you can choose to use the opensearch template instead of the template generated by ContextSearch. 
* Link to MycroftProject to browse opensearch xml files for the current domain
* Open a Create Custom Engine form to customize and test the engine before installing. You can also change it after installing from the [Search Engines Manager](#searchenginesmanager)

<a name="highlighting"/>

## Highlighting Searched Words
After performing a search, search terms in the results page can be highlighted. The highlight styling and behaviour can be found in CS Options -> Highlight

Highlighting can be removed from a page by pressing ESC

<a name="modifyingterms"/>

## Modifying Search Terms
Each search engine's handling of the query string can be modified with the `Search Regex` field. The format should be a well-formed array in the following order:

`FIND_REGEX, REPLACE_REGEX [, REGEX_MODIFIERS]`

Some search engines require `+` instead of spaces. In this case, to change a query from `this is a search` to `this+is+a+search` the Search Regex would be `"\\s","+"`. Note the use of quotes and the need to escape the backslash. A literal backslash would require four backslashes `\\\\`

Regex can be chained using one regex replacement per line in the Search Regex field.

<a name="javascriptengines"/>

## Javascript-Driven Search Engines
Some websites use search bars that do not offer a GET or POST query, instead relying on web forms and javascript. For these engines, the template should exclude `{searchTerms}` and instead users can rely on the Search Code field. This field allows users to write javascript code to be executed after the GET or POST query is performed. For most javascript-driven engines, this means setting the search template to the URL of the website's search form and using DOM and CSS selectors to fill in the search form and simulate a submit.

For a simple example, if somewebsite.com used a javascript-driven search form, we could perform the search by using the Search Code field like this

* Name: Some Website Search Engine
* Template: https://somewebsite.com
* Method: **GET**
* POST params: *empty*
* Search Code:
```javascript
let input = document.querySelector('input');
input.value = searchTerms;
input.dispatchEvent(new KeyboardEvent('keydown', {keyCode:13, key:'Enter'}));
```

The search bar is assumed to be the first INPUT element which is filled in with the query string using the CS variable `searchTerms` and the Enter key is simulated. 

Some sites will require more precise selectors and events ( click, change, etc ) in order to perform a search, but nearly all should be accessible with the search code field.

<a name="loginsandtokens"/>

## Search Engines Requiring Logins and Tokens
The same approach as the Javascript-Driven Search Engines above may be used to bypass session-based tokens and logins, provided the user is logged in using cookies or otherwise authenticated.

<a name="bookmarklets"/>

## Bookmarklets 
Most browsers can run custom javascript from bookmarks using [bookmarklets](https://en.wikipedia.org/wiki/Bookmarklet) formatting. You can add bookmarklets to CS menus through CS Options -> Search Engines -> right click menu -> Add Bookmarklet. This opens a list of all bookmarklets found in your Bookmarks. Simply click the name of the bookmarlet you want to add.

Bookmarklets have access to the [Content Script API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#WebExtension_APIs) (useful for messaging the background page and accessing CS functions)

You could, for instance, create a search engine tile that toggles the 'menuless search via hotkey' option using the following bookmarklet code:

```javascript
javascript:(async () => {
	userOptions.allowHotkeysWithoutMenu = !userOptions.allowHotkeysWithoutMenu;
	browser.runtime.sendMessage({action: "showNotification", msg: "hotkeys are " + (userOptions.allowHotkeysWithoutMenu ? "on" : "off")});
})();
```

The variable `userOptions.allowHotkeysWithoutMenu` is toggled for the current tab and a short notification is displayed by messaging the extension background page. Check out background.js -> notify() for available actions.

<a name="templateparameters"/>

## Template Parameters
`{searchTerms}` - The current selection or link URL / image URL \
`{domain}` - Current domain ( "`http://www.example.com/this/path/`" -> `example.com` ) \
`{subdomain}` - Current subdomain ( "`http://www.example.com/this/path/`" -> `www.example.com` ) \
`{selectdomain}` - Engine becomes a folder with all subdomains and paths listed separately ( "`http://www.example.com/this/path/`" -> `example.com`, `www.example.com`, `www.example.com/this`, `www.example.com/this/path` ) 

<a name="styling"/>

## Menu Styling
Most CSS styling can be overridden in Options -> General -> User Styles.

A few examples...

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/gradient_menu.png" width="200px" />

sunset gradient background and white tools ( newer code )
```css
:root {
    --background: linear-gradient(#e66465, #9198e5);
    --tools-color:white;
}
```

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/gradient_menu_blue.png" width="200px" />

blue gradient background no tile borders and off-white tools for the quick menu only ( older code )
```css
[data-menu="quickmenu"] { background:linear-gradient(315deg, rgba(2,0,36,1) 0%, rgba(120,120,255,1) 35%, rgba(0,212,255,1) 100%); }
.tile { border-color:transparent;}
:root { --tools-color:#ddd; }

```

gradient background and white tools for all menus ( older code )
```css
[data-menu] { background:linear-gradient(#e66465, #9198e5);}
:root { --tools-color:white; }
```
---

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/image_menu_green.png" width="200px" />

image background semi-transparent border white text and olive tools for all menus ( newer code )
```css
:root {
    --background: url('https://www.ppt-backgrounds.net/thumbs/green-slide-download-downloads-backgrounds.jpg') repeat fixed right center;
    --tools-color: olive;
    --border:rgba(255,255,255,.3);
    color:white;
}
```

<img src="https://raw.githubusercontent.com/ssborbis/ContextSearch-web-ext/native-app-support/media/image_menu_border_radius.png" width="200px" />

image background with tile modifications borders tools and text 
```css
:root {
    --tools-color: #ddd;
    --border:rgba(255,255,255,.2);
    --background: url('https://img5.goodfon.com/wallpaper/nbig/f/b6/gradient-abstraktsiia-sinii-linii-background.jpg');
    color:white;
}

.tile {
    border-radius:10px;
    margin:4px;
    background-color:rgba(255,255,255,.3);
}
```

No quick menu resize handle:
```css
.CS_resizeWidget { display:none; }
```

Smaller tools bar
```css
#toolBar .tile {
    transform:scale(.60);
}
```

Fat green qm border
```css
#CS_quickMenuIframe {
    border-width:6px;
    border-color: #6ec179;
}
```


