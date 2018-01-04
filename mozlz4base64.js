function readMozlz4Base64String(str)
{
	let input = Uint8Array.from(atob(str), c => c.charCodeAt(0));
	let output;
	let uncompressedSize = input.length*3;  // size estimate for uncompressed data!

	// Decode whole file.
	do {
		output = new Uint8Array(uncompressedSize);
		uncompressedSize = decodeLz4Block(input, output, 8+4);  // skip 8 byte magic number + 4 byte data size field
		// if there's more data than our output estimate, create a bigger output array and retry (at most one retry)
	} while (uncompressedSize > output.length);

	output = output.slice(0, uncompressedSize); // remove excess bytes

	let decodedText = new TextDecoder().decode(output);
	console.log(JSON.parse(decodedText));
};