
// Main TinySID Object
jsSID.TinySID = function(opts) {
        opts = opts || {};
	this.mix_freq = opts.sampleRate || 44100;	
	this.mem = opts.memory || null;

	this.freq_mul = Math.floor(15872000 / this.mix_freq);
	this.filt_mul = Math.floor(jsSID.TinySID.pFloat.convertFromFloat(21.5332031) / this.mix_freq);

	var attackTimes = new Array(
		0.0022528606, 0.0080099577, 0.0157696042, 0.0237795619,
		0.0372963655, 0.0550684591, 0.0668330845, 0.0783473987,
		0.0981219818, 0.244554021,  0.489108042,  0.782472742,
		0.977715461,  2.93364701,   4.88907793,   7.82272493
	);
	var decayReleaseTimes = new Array(
		0.00891777693, 0.024594051, 0.0484185907, 0.0730116639,
		0.114512475,   0.169078356, 0.205199432,  0.240551975,
		0.301266125,   0.750858245, 1.50171551,   2.40243682,
		3.00189298,    9.00721405,  15.010998,    24.0182111
	);

	this.attacks = new Array(16);
	this.releases = new Array(16);
	var i;
	for ( i = 0; i < 16; i++) {
		this.attacks[i]  = Math.floor(0x1000000 / ( attackTimes[i] * this.mix_freq ) );
		this.releases[i] = Math.floor(0x1000000 / ( decayReleaseTimes[i] * this.mix_freq ) );
	}

	// Start core sid registers
	this.v = new Array(3);
	for ( i = 0; i < 3; i++) {
		this.v[i] = new Object({
			freq: 0,		// word
			pulse: 0,		// word
			wave: 0,		// byte
			ad: 0,			// byte
			sr: 0			// byte
		});
	}
	this.ffreqlo = 0;	// byte
	this.ffreqhi = 0;	// byte
	this.res_ftv = 0;	// byte
	this.ftp_vol = 0;	// byte
	// End core sid registers
	
	// Internal representations
	this.osc = new Array(3);
	for ( i = 0; i < 3; i++) {
		this.osc[i] = new jsSID.TinySID.Osc(this, i);
		this.osc[i].noiseval = 0xffffff;
	}
	this.filter = new jsSID.TinySID.Filter(this);

	// internal values used to handle "Digi" sample handling
	this.internal_period = 0;
	this.internal_order = 0;
	this.internal_start = 0;
	this.internal_end = 0;
	this.internal_add = 0;
	this.internal_repeat_times = 0;
	this.internal_repeat_start = 0;

	// also related to digi handling
	this.sample_active = 0;
	this.sample_position = 0;
	this.sample_start = 0;
	this.sample_end = 0;
	this.sample_repeat_start = 0;
	this.fracPos = 0;         /* Fractal position of sample */
	this.sample_period = 0;
	this.sample_repeats = 0;
	this.sample_order = 0;
	this.sample_nibble = 0;

	// converted from statics in generateDigi
	this.sample = 0;
	//this.last_sample = 0;


}

// generate count samples into buffer at offset
jsSID.TinySID.prototype.generateIntoBuffer = function(count, buffer, offset) {
	//console.log("TinySID.generateIntoBuffer (count: " + count + ", offset: " + offset + ")");

	// FIXME: this could be done in one pass. (No?)
	for (var i = offset; i < offset + count; i++) {
		buffer[i] = 0;
	}

	var v;
	for ( v = 0; v < 3; v++) {
		this.osc[v].precalc();
	}
	this.filter.precalc();

	var bp;
	var endbp = count + offset;

	for (bp = offset; bp < endbp; bp += 1) {
		var outo = 0;
		var outf = 0;
		
		for ( v = 0; v < 3; v++) {
			var thisosc = this.osc[v];
			thisosc.sampleUpdate();

			if ( v < 2 || this.filter.v3ena) {
				if (thisosc.filter) {
					outf += ( ( thisosc.outv - 0x80 ) * thisosc.envval) >> 22;
				} else {
					outo += ( ( thisosc.outv - 0x80 ) * thisosc.envval) >> 22;
				}
			}

		}

		this.filter.h = jsSID.TinySID.pFloat.convertFromInt(outf) - (this.filter.b >> 8) * this.filter.rez - this.filter.l;
		this.filter.b += jsSID.TinySID.pFloat.multiply(this.filter.freq, this.filter.h);
		this.filter.l += jsSID.TinySID.pFloat.multiply(this.filter.freq, this.filter.b);

		outf = 0;
		if (this.filter.l_ena) outf += jsSID.TinySID.pFloat.convertToInt(this.filter.l);
		if (this.filter.b_ena) outf += jsSID.TinySID.pFloat.convertToInt(this.filter.b);
		if (this.filter.h_ena) outf += jsSID.TinySID.pFloat.convertToInt(this.filter.h);

		// FIXME: Digi support disabled for now
		var final_sample = parseFloat(this.generateDigi(this.filter.vol * ( outo + outf ))) / 32768;
		//var final_sample = parseFloat(this.filter.vol * ( outo + outf ) ) / 32768;
		buffer[bp] = final_sample;
	}
	return count;
};

jsSID.TinySID.prototype.generateDigi = function(sIn) {

	if ((!this.sample_active) || (this.mem === null)) return(sIn);

	if ((this.sample_position < this.sample_end) && (this.sample_position >= this.sample_start)) {
		//Interpolation routine
		//float a = (float)fracPos/(float)mixing_frequency;
		//float b = 1-a;
		//sIn += a*sample + b*last_sample;

		sIn += this.sample;

		this.fracPos += 985248 / this.sample_period;

		if (this.fracPos > this.mix_freq) {
			this.fracPos %= this.mix_freq;

			//this.last_sample = this.sample;

			if (this.sample_order === 0) {
				this.sample_nibble++;
				if (this.sample_nibble == 2) {
					this.sample_nibble = 0;
					this.sample_position++;
				}
			} else {
				this.sample_nibble--;
				if (this.sample_nibble < 0) {
					this.sample_nibble = 1;
					this.sample_position++;
				}
			}
			if (this.sample_repeats) {
				if (this.sample_position > this.sample_end) {
					this.sample_repeats--;
					this.sample_position = this.sample_repeat_start;
				} else {
					this.sample_active = 0;
				}
			}

			this.sample = this.mem[this.sample_position & 0xffff];
			if (this.sample_nibble == 1) {
				this.sample = (this.sample & 0xf0) >> 4;
			} else {
				this.sample = this.sample & 0x0f;
			}

			this.sample -= 7;
			this.sample <<= 10;
		}
	}

	return (sIn);
};

jsSID.TinySID.prototype.generate = function(samples) {
	var data = new Array(samples);
	this.generateIntoBuffer(samples, data, 0);
	return data;
};

jsSID.TinySID.prototype.poke = function(reg, val) {

	var voice = 0;
	//if ((reg >= 0) && (reg <= 6)) voice=0;
	if ((reg >= 7) && (reg <=13)) {voice=1; reg-=7;}
	else if ((reg >= 14) && (reg <=20)) {voice=2; reg-=14;}

	switch (reg) {
		case 0:
			this.v[voice].freq = (this.v[voice].freq & 0xff00) + val;
			break;
		case 1:
			this.v[voice].freq = (this.v[voice].freq & 0xff) + (val << 8);
			break;
		case 2:
			this.v[voice].pulse = (this.v[voice].pulse & 0xff00) + val;
			break;
		case 3:
			this.v[voice].pulse = (this.v[voice].pulse & 0xff) + (val << 8);
			break;
		case 4:
			this.v[voice].wave = val;
			if ((val & 0x01) === 0) this.osc[voice].envphase = 3;
			else if (this.osc[voice].envphase == 3) this.osc[voice].envphase = 0;
			break;
		case 5:
			this.v[voice].ad = val;
			break;
		case 6:
			this.v[voice].sr = val;
			break;
		case 21:
			this.ffreqlo = val;
			break;
		case 22:
			this.ffreqhi = val;
			break;
		case 23:
			this.res_ftv = val;
			break;
		case 24:
			this.ftp_vol = val;
			break;
	}
};

jsSID.TinySID.prototype.pokeDigi = function(addr, value) {

	// FIXME: Should be a switch/case block
	// Start-Hi
	if (addr == 0xd41f) {
		this.internal_start = (this.internal_start & 0x00ff) | (value << 8);
	}

	// Start-Lo
	if (addr == 0xd41e) {
		this.internal_start = (this.internal_start & 0xff00) | (value);
	}

	// Repeat-Hi
	if (addr == 0xd47f) {
		this.internal_repeat_start = (this.internal_repeat_start & 0x00ff) | (value << 8);
	}

	// Repeat-Lo
	if (addr == 0xd47e) {
		this.internal_repeat_start = (this.internal_repeat_start & 0xff00) | (value);
	}

	// End-Hi
	if (addr == 0xd43e) {
		this.internal_end = (this.internal_end & 0x00ff) | (value << 8);
	}

	// End-Lo
	if (addr == 0xd43d) {
		this.internal_end = (this.internal_end & 0xff00) | (value);
	}

	// Loop-Size
	if (addr == 0xd43f) {
		this.internal_repeat_times = value;
	}

	// Period-Hi
	if (addr == 0xd45e) {
		this.internal_period = (this.internal_period & 0x00ff) | (value << 8);
	}

	// Period-Lo
	if (addr == 0xd45d) {
		this.internal_period = (this.internal_period & 0xff00) | (value);
	}

	// Sample Order
	if (addr == 0xd47d) {
		this.internal_order = value;
	}

	// Sample Add
	if (addr == 0xd45f) {
		this.internal_add = value;
	}

	// Start-Sampling
	if (addr == 0xd41d)
	{
		this.sample_repeats = this.internal_repeat_times;
		this.sample_position = this.internal_start;
		this.sample_start = this.internal_start;
		this.sample_end = this.internal_end;
		this.sample_repeat_start = this.internal_repeat_start;
		this.sample_period = this.internal_period;
		this.sample_order = this.internal_order;
		switch (value)
		{
			case 0xfd:
				this.sample_active = 0;
				break;
			case 0xfe:
			case 0xff:
				this.sample_active = 1;
				break;
			default:
				return;
		}
	}

};


// FIXME: move up?
// val(dword), bit(byte), returns byte (1 or 0)
jsSID.TinySID.get_bit = function(val, bit) {
	return ((val >> bit) & 1);
};

// TinySID Filter Object
jsSID.TinySID.Filter = function(sidinstance) {
	this.sid = sidinstance;

	// internal filter def
	this.freq	= 0;		// int
	this.l_ena	= 0;		// byte
	this.b_ena	= 0;		// byte
	this.h_ena	= 0;		// byte
	this.v3ena	= 0;		// byte
	this.vol	= 0;		// int
	this.rez	= 0;		// int
	this.h		= 0;		// int
	this.b		= 0;		// int
	this.l		= 0;		// int
}

jsSID.TinySID.Filter.prototype.precalc = function() {
	//this.freq  = (4 * this.sid.ffreqhi + (this.sid.ffreqlo & 0x7)) * this.filt_mul;
	this.freq  = (16 * this.sid.ffreqhi + (this.sid.ffreqlo & 0x7)) * this.sid.filt_mul;

	if ( this.freq > jsSID.TinySID.pFloat.convertFromInt(1) ) {
		this.freq = jsSID.TinySID.pFloat.convertFromInt(1);
	}
	this.l_ena = jsSID.TinySID.get_bit(this.sid.ftp_vol,4);
	this.b_ena = jsSID.TinySID.get_bit(this.sid.ftp_vol,5);
	this.h_ena = jsSID.TinySID.get_bit(this.sid.ftp_vol,6);
	this.v3ena = !jsSID.TinySID.get_bit(this.sid.ftp_vol,7);
	this.vol   = (this.sid.ftp_vol & 0xf);
	this.rez   = jsSID.TinySID.pFloat.convertFromFloat(1.2) - jsSID.TinySID.pFloat.convertFromFloat(0.04) * (this.sid.res_ftv >> 4);
	this.rez   >>= 8;
};


// TinySID Oscilator Object
jsSID.TinySID.Osc = function(sidinstance, voicenum) {
	this.sid = sidinstance;
	this.vnum = voicenum;
	this.refosc = voicenum ? (voicenum - 1) : 2;
	this.v = sidinstance.v[voicenum];
	this.freq	= 0;		// dword
	this.pulse	= 0;		// dword
	this.wave	= 0;		// byte
	this.filter	= 0;		// byte
	this.attack	= 0;		// dword
	this.decay	= 0;		// dword
	this.sustain	= 0;		// dword
	this.release	= 0;		// dword
	this.counter	= 0;		// dword
	this.envval	= 0;		// signed int
	this.envphase	= 0;		// byte
	this.noisepos   = 0;		// dword
	this.noiseval   = 0xffffff;	// dword
	this.noiseout	= 0;		// byte
	this.triout	= 0;		// byte
	this.sawout	= 0;		// byte
	this.plsout	= 0;		// byte
	this.outv	= 0;		// byte

}

// Pre-calc values common to a sample set
jsSID.TinySID.Osc.prototype.precalc = function() {
	this.pulse   = (this.v.pulse & 0xfff) << 16;
	this.filter  = jsSID.TinySID.get_bit(this.sid.res_ftv, this.vnum);
	this.attack  = this.sid.attacks[this.v.ad >> 4];
	this.decay   = this.sid.releases[this.v.ad & 0xf];
	this.sustain = this.v.sr & 0xf0;
	this.release = this.sid.releases[this.v.sr & 0xf];
	this.wave    = this.v.wave;
	this.freq    = this.v.freq * this.sid.freq_mul;
};

// Called for each oscillator for each sample
jsSID.TinySID.Osc.prototype.sampleUpdate = function() {

	this.counter = ( this.counter + this.freq) & 0xFFFFFFF;
	if (this.wave & 0x08) {
		this.counter  = 0;
		this.noisepos = 0;
		this.noiseval = 0xffffff;
	}
	if (this.wave & 0x02) {
		var thisrefosc = this.sid.osc[this.refosc];
		if (thisrefosc.counter < thisrefosc.freq) {
			this.counter = Math.floor(thisrefosc.counter * this.freq / thisrefosc.freq);
		}
	}
	this.triout = (this.counter>>19) & 0xff;
	if ( this.counter >> 27) {
		this.triout ^= 0xff;
	}
	this.sawout = (this.counter >> 20) & 0xff;
	this.plsout = (this.counter > this.pulse) ? 0 : 0xff;
	if ( this.noisepos != ( this.counter >> 23 ) ) {
		this.noisepos = this.counter >> 23;
		this.noiseval = (this.noiseval << 1) | 
			(jsSID.TinySID.get_bit(this.noiseval,22) ^ jsSID.TinySID.get_bit(this.noiseval,17));
		this.noiseout = 
			(jsSID.TinySID.get_bit(this.noiseval,22) << 7) |
			(jsSID.TinySID.get_bit(this.noiseval,20) << 6) |
			(jsSID.TinySID.get_bit(this.noiseval,16) << 5) |
			(jsSID.TinySID.get_bit(this.noiseval,13) << 4) |
			(jsSID.TinySID.get_bit(this.noiseval,11) << 3) |
			(jsSID.TinySID.get_bit(this.noiseval, 7) << 2) |
			(jsSID.TinySID.get_bit(this.noiseval, 4) << 1) |
			(jsSID.TinySID.get_bit(this.noiseval, 2) << 0);
	}
	if (this.wave & 0x04) {
		if (this.sid.osc[this.refosc].counter < 0x8000000) {
			this.triout ^= 0xff;
		}
	}
	this.outv = 0xFF;
	if (this.wave & 0x10) this.outv &= this.triout;
	if (this.wave & 0x20) this.outv &= this.sawout;
	if (this.wave & 0x40) this.outv &= this.plsout;
	if (this.wave & 0x80) this.outv &= this.noiseout;

	// MOVED to poke (for now)
	//if ( !(this.wave & 0x01)) {
	//	this.envphase = 3;
	//} else if (this.envphase == 3) {
	//	this.envphase = 0;
	//}

	switch (this.envphase) {
		case 0:                          // Phase 0 : Attack
			this.envval += this.attack;
			if (this.envval >= 0xFFFFFF) {
				this.envval   = 0xFFFFFF;
				this.envphase = 1;
			}
			break;
		case 1:                          // Phase 1 : Decay
			this.envval -= this.decay;
			if (this.envval <= (this.sustain << 16)) {
				this.envval   = this.sustain << 16;
				this.envphase = 2;
			}
			break;
		case 2:                          // Phase 2 : Sustain
			if (this.envval != (this.sustain << 16)) {
				this.envphase = 1;
			}
			break;
		case 3:                          // Phase 3 : Release
			this.envval -= this.release;
			if (this.envval < 0x40000) {
				this.envval = 0x40000;
			}
			break;
	}
};


// start pFloat
jsSID.TinySID.pFloat = function() {}
jsSID.TinySID.pFloat.convertFromInt = function(i) {
	return (i<<16) & 0xffffffff;
};
jsSID.TinySID.pFloat.convertFromFloat = function(f) {
	return Math.floor(parseFloat(f) * 65536) & 0xffffffff;
};
jsSID.TinySID.pFloat.convertToInt = function(i) {
	return (i>>16) & 0xffffffff;
};
jsSID.TinySID.pFloat.multiply = function(a, b) {
	return ((a>>8)*(b>>8)) & 0xffffffff;
};
// end pFloat;


// add driver profile(s) to registry:
jsSID.synth.tinysid = {
	desc: "TinySID",
        class: "TinySID",
	opts: {}
}

