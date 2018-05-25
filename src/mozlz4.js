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
        let input = new Uint8Array(reader.result);
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
        onRead(decodedText);
    };

    if (onError) {
        reader.onerror = onError;
    }

    reader.readAsArrayBuffer(file); // read as bytes
};