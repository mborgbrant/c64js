/* Wrapper for accessing strings through sequential reads */
function Stream(str) {
	var position = 0;
	
	function seek(newpos) {
		position = newpos;
	}

	function read(length) {
		var result = str.substr(position, length);
		position += length;
		return result;
	}
	
	/* read a big-endian 32-bit integer */
	function readInt32() {
		var result = ( (str.charCodeAt(position) << 24) +
			(str.charCodeAt(position + 1) << 16) +
			(str.charCodeAt(position + 2) << 8) +
			str.charCodeAt(position + 3));
		position += 4;
		return result;
	}

	/* read a big-endian 16-bit integer */
	function readInt16() {
		var result = ( (str.charCodeAt(position) << 8) + str.charCodeAt(position + 1));
		position += 2;
		return result;
	}
	
	/* read an 8-bit integer */
	function readInt8(signed) {
		var result = str.charCodeAt(position);
		if (signed && result > 127) result -= 256;
		position += 1;
		return result;
	}
	
	function eof() {
		return position >= str.length;
	}
	
	/* read a MIDI-style variable-length integer
		(big-endian value in groups of 7 bits,
		with top bit set to signify that another byte follows)
	*/
	function readVarInt() {
		var result = 0;
		while (true) {
			var b = readInt8();
			if (b & 0x80) {
				result += (b & 0x7f);
				result <<= 7;
			} else {
				/* b is the last byte */
				return result + b;
			}
		}
	}
	
	return {
		'eof': eof,
		'seek': seek,
		'read': read,
		'readInt32': readInt32,
		'readInt16': readInt16,
		'readInt8': readInt8,
		'readVarInt': readVarInt
	};
}

Stream.loadRemoteFile = function (path, callback) {
	var fetch = new XMLHttpRequest();
	fetch.open('GET', path);
	if(fetch.overrideMimeType) fetch.overrideMimeType("text/plain; charset=x-user-defined");
	if(fetch.responseType) fetch.responseType = "arraybuffer";
	fetch.onreadystatechange = function() {
		if(this.readyState == 4 && this.status == 200) {
			/* munge response into a binary string */
			var t = this.responseText || "" ;
			var ff = [];
			var mx = t.length;
			var scc= String.fromCharCode;
			for (var z = 0; z < mx; z++) {
				ff[z] = scc(t.charCodeAt(z) & 255);
			}
			callback(ff.join(""));
		}
	};
	fetch.send();
};


Stream.Base64DecodeEnumerator = function(input)
{
    this._input = input;
    this._index = -1;
    this._buffer = [];
};

Stream.Base64DecodeEnumerator.prototype =
{
    current: 64,

    codex : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    moveNext: function()
    {
        if (this._buffer.length > 0)
        {
            this.current = this._buffer.shift();
            return true;
        }
        else if (this._index >= (this._input.length - 1))
        {
            this.current = 64;
            return false;
        }
        else
        {
            var enc1 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc2 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc3 = this.codex.indexOf(this._input.charAt(++this._index));
            var enc4 = this.codex.indexOf(this._input.charAt(++this._index));

            var chr1 = (enc1 << 2) | (enc2 >> 4);
            var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            var chr3 = ((enc3 & 3) << 6) | enc4;

            this.current = chr1;

            if (enc3 != 64)
                this._buffer.push(chr2);

            if (enc4 != 64)
                this._buffer.push(chr3);

            return true;
        }
    }
};

Stream.Base64Decode = function(input) {

        var output = []; 

        var enumerator = new Stream.Base64DecodeEnumerator(input);
        while (enumerator.moveNext())
        {
            var charCode = enumerator.current;
            output.push(String.fromCharCode(charCode));
        }

        return output.join("");
};


