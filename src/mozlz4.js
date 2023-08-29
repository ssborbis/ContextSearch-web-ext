// Code and annotations by CanisLupus @ https://stackoverflow.com/questions/46130021/reading-an-lz4-compressed-text-file-mozlz4-in-webextensions-javascript-firef

// This method's code was taken from node-lz4 by Pierre Curto. MIT license.
// CHANGES: Added ; to all lines. Reformated one-liners. Removed n = eIdx. Fixed eIdx skipping end bytes if sIdx != 0.
function decodeLz4Block(input, output, sIdx, eIdx)
{
    sIdx = sIdx || 0;
    eIdx = eIdx || input.length;

    // Process each sequence in the incoming data
    for (var i = sIdx, j = 0; i < eIdx;)
    {
        var token = input[i++];

        // Literals
        var literals_length = (token >> 4);
        if (literals_length > 0) {
            // length of literals
            var l = literals_length + 240;
            while (l === 255) {
                l = input[i++];
                literals_length += l;
            }

            // Copy the literals
            var end = i + literals_length;
            while (i < end) {
                output[j++] = input[i++];
            }

            // End of buffer?
            if (i === eIdx) {
                return j;
            }
        }

        // Match copy
        // 2 bytes offset (little endian)
        var offset = input[i++] | (input[i++] << 8);

        // 0 is an invalid offset value
        if (offset === 0 || offset > j) {
            return -(i-2);
        }

        // length of match copy
        var match_length = (token & 0xf);
        var l = match_length + 240;
        while (l === 255) {
            l = input[i++];
            match_length += l;
        }

        // Copy the match
        var pos = j - offset; // position of the match copy in the current output
        var end = j + match_length + 4; // minmatch = 4
        while (j < end) {
            output[j++] = output[pos++];
        }
    }

    return j;
}

function readMozlz4File(file, onRead, onError)
{
    let reader = new FileReader();

    reader.onload = function() {
       let decodedText = decompress(reader.result);
        onRead(decodedText);
    };

    if (onError) {
        reader.onerror = onError;
    }

    reader.readAsArrayBuffer(file); // read as bytes
};

function magicBitsToUint32(arr) {
	console.log(arr);
	var data = new Uint8Array(arr);
	var dataview = new DataView(data.buffer);
	return dataview.getUint32(0, true);
}

function magicBitsFromUint32(i) {
	var buffer = new ArrayBuffer(4);
	var dataview = new DataView(buffer);
	dataview.setUint32(0, i, true);
	return new Uint8Array(buffer);
}

var
	maxInputSize	= 0x7E000000
,	minMatch		= 4
// uint32() optimization
,	hashLog			= 16
,	hashShift		= (minMatch * 8) - hashLog
,	hashSize		= 1 << hashLog

,	copyLength		= 8
,	lastLiterals	= 5
,	mfLimit			= copyLength + minMatch
,	skipStrength	= 6

,	mlBits  		= 4
,	mlMask  		= (1 << mlBits) - 1
,	runBits 		= 8 - mlBits
,	runMask 		= (1 << runBits) - 1

,	hasher 			= 2654435761

compressBound = function (isize) {
	return isize > maxInputSize
		? 0
		: (isize + (isize/255) + 16) | 0
}

compress = function (input, dst, sIdx, eIdx) {
	// V8 optimization: non sparse array with integers
	var hashTable = new Array(hashSize)
	for (var i = 0; i < hashSize; i++) {
		hashTable[i] = 0
	}
	return compressBlock(input, dst, 0, hashTable, sIdx || 0, eIdx || dst.length)
}

function compressBlock(input, dst, pos, hashTable, sIdx, eIdx) {
	var dpos = sIdx
	var dlen = eIdx - sIdx
	var anchor = 0

	if (input.length >= maxInputSize) throw new Error("input too large")

	// Minimum of input bytes for compression (LZ4 specs)
	if (input.length > mfLimit) {
		var n = compressBound(input.length)
		if ( dlen < n ) throw Error("output too small: " + dlen + " < " + n)

		var 
			step  = 1
		,	findMatchAttempts = (1 << skipStrength) + 3
		// Keep last few bytes incompressible (LZ4 specs):
		// last 5 bytes must be literals
		,	inputLength = input.length - mfLimit

		while (pos + minMatch < inputLength) {
			// Find a match
			// min match of 4 bytes aka sequence
			var sequenceLowBits = input[pos+1]<<8 | input[pos]
			var sequenceHighBits = input[pos+3]<<8 | input[pos+2]
			// compute hash for the current sequence
			var hash = Math.imul(sequenceLowBits | (sequenceHighBits << 16), hasher) >>> hashShift
			// get the position of the sequence matching the hash
			// NB. since 2 different sequences may have the same hash
			// it is double-checked below
			// do -1 to distinguish between initialized and uninitialized values
			var ref = hashTable[hash] - 1
			// save position of current sequence in hash table
			hashTable[hash] = pos + 1

			// first reference or within 64k limit or current sequence !== hashed one: no match
			if ( ref < 0 ||
				((pos - ref) >>> 16) > 0 ||
				(
					((input[ref+3]<<8 | input[ref+2]) != sequenceHighBits) ||
					((input[ref+1]<<8 | input[ref]) != sequenceLowBits )
				)
			) {
				// increase step if nothing found within limit
				step = findMatchAttempts++ >> skipStrength
				pos += step
				continue
			}

			findMatchAttempts = (1 << skipStrength) + 3

			// got a match
			var literals_length = pos - anchor
			var offset = pos - ref

			// minMatch already verified
			pos += minMatch
			ref += minMatch

			// move to the end of the match (>=minMatch)
			var match_length = pos
			while (pos < inputLength && input[pos] == input[ref]) {
				pos++
				ref++
			}

			// match length
			match_length = pos - match_length

			// token
			var token = match_length < mlMask ? match_length : mlMask

			// encode literals length
			if (literals_length >= runMask) {
				// add match length to the token
				dst[dpos++] = (runMask << mlBits) + token
				for (var len = literals_length - runMask; len > 254; len -= 255) {
					dst[dpos++] = 255
				}
				dst[dpos++] = len
			} else {
				// add match length to the token
				dst[dpos++] = (literals_length << mlBits) + token
			}

			// write literals
			for (var i = 0; i < literals_length; i++) {
				dst[dpos++] = input[anchor+i]
			}

			// encode offset
			dst[dpos++] = offset
			dst[dpos++] = (offset >> 8)

			// encode match length
			if (match_length >= mlMask) {
				match_length -= mlMask
				while (match_length >= 255) {
					match_length -= 255
					dst[dpos++] = 255
				}

				dst[dpos++] = match_length
			}

			anchor = pos
		}
	}

	// cannot compress input
	if (anchor == 0) {
		throw new Error("cannot compress");
		return 0;
	}

	// Write last literals
	// encode literals length
	literals_length = input.length - anchor
	if (literals_length >= runMask) {
		// add match length to the token
		dst[dpos++] = (runMask << mlBits)
		for (var ln = literals_length - runMask; ln > 254; ln -= 255) {
			dst[dpos++] = 255
		}
		dst[dpos++] = ln
	} else {
		// add match length to the token
		dst[dpos++] = (literals_length << mlBits)
	}

	// write literals
	pos = anchor
	while (pos < input.length) {
		dst[dpos++] = input[pos++]
	}

	return dpos;
}

function encodeLz4Block(data) {

	let output = new Array(data.length * 3);
	let size = compress(data, output);

	return output.slice(0,size);	
}

function encodeMozLz4(data) {
	let enc_str = new TextEncoder("utf-8").encode(data);
	let comp = encodeLz4Block(enc_str);
	
	let header = new TextEncoder("utf-8").encode("mozLz40\0");
	let size = magicBitsFromUint32(enc_str.length);
	
	let mozlz4 = Uint8Array.from([...header, ...size, ...comp]).buffer;
	
	return mozlz4;
	
}

function decompress(data) {
	let input = new Uint8Array(data);
	let output;
	let uncompressedSize = input.length*3;  // size estimate for uncompressed data!
	
	// Decode whole file.
	do {
		output = new Uint8Array(uncompressedSize);
		uncompressedSize = decodeLz4Block(input, output, 8+4 );  // skip 8 byte magic number + 4 byte data size field
		// if there's more data than our output estimate, create a bigger output array and retry (at most one retry)
	} while (uncompressedSize > output.length);

	output = output.slice(0, uncompressedSize); // remove excess bytes

	let decodedText = new TextDecoderDefault().decode(output);
	
	return decodedText;
}

function exportFile( data, filename ) {
	let b = new Blob([data], {type: "octet/stream"});
	url = window.URL.createObjectURL(b);
	
	var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
	a.href = url;
	a.download = filename;
	a.click();
	window.URL.revokeObjectURL(url);
}

function exportSearchJsonMozLz4(data) {	
	let output = encodeMozLz4(data);
	
	exportFile(output, "search.json.mozlz4");
}
