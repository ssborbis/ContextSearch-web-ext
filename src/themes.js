const themes = [
	{ name: "lite", path: "/styles/lite.css"},
	{ name: "dark", path: "/styles/dark.css"},
	// { name: "sunset", path: "/styles/sunset.css"},
	// { name: "blue", path: "/styles/blue.css"},
	{ name: "modern", path: "/styles/modern.css"},
	{ name: "modern purple", path: "/styles/modern-purple.css", requires: ["/styles/modern.css"]},
	{ name: "modern sunset", path: "/styles/modern-sunset.css", requires: ["/styles/modern.css"]}
];