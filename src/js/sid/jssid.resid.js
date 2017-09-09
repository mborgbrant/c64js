
// Main Object
jsSID.ReSID = function(opts) {
        opts = opts || {};
        this.sid_model = opts.model || jsSID.chip.model.MOS6581;
        var clkRate = opts.clock || jsSID.chip.clock.PAL;
	var sampleRate = opts.sampleRate || 44100;
	var method = opts.method || jsSID.ReSID.sampling_method.SAMPLE_FAST;

	this.bus_value = 0;
	this.bus_value_ttl = 0;
	this.ext_in = 0;

	// these are arrays/tables built at runtime
	this.sample = null;
	this.fir = null;

	this.voice = new Array(3);
	for(var i = 0; i < 3; i++) {
		this.voice[i] = new jsSID.ReSID.Voice();
	}
	this.filter = new jsSID.ReSID.Filter();
	this.extfilt = new jsSID.ReSID.ExternalFilter();
	this.voice[0].set_sync_source(this.voice[2]);
	this.voice[1].set_sync_source(this.voice[0]);
	this.voice[2].set_sync_source(this.voice[1]);

	this.set_sampling_parameters(clkRate, method, sampleRate);
        this.set_chip_model(this.sid_model);
}
//FIXME: original had destructor calling "delete[] sample; delete fir[]". Shouldn't matter we don't.

jsSID.ReSID.const = Object.freeze({
	FIR_N: 125,
	FIR_RES_INTERPOLATE: 285,
	FIR_RES_FAST: 51473,
	FIR_SHIFT: 15,
	RINGSIZE: 16384,
	FIXP_SHIFT: 16,
	FIXP_MASK: 0xffff
});

// EnvelopeGenerator
jsSID.ReSID.EnvelopeGenerator = function() {
	this.reset();
};

jsSID.ReSID.EnvelopeGenerator.State = Object.freeze({
	ATTACK: {}, DECAY_SUSTAIN: {}, RELEASE: {}
});

jsSID.ReSID.EnvelopeGenerator.rate_counter_period = Array(
	9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19532, 31251
);

// this one seems like overkill... idx +  (idx<<4) should do it...
jsSID.ReSID.EnvelopeGenerator.sustain_level = Array(
	0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff
);

jsSID.ReSID.EnvelopeGenerator.prototype.reset = function() {
	this.envelope_counter = 0;
	this.attack = 0;
	this.decay = 0;
	this.sustain = 0;
	this.release = 0;
	this.gate = 0;
	this.rate_counter = 0;
	this.exponential_counter = 0;
	this.exponential_counter_period = 1;
	this.state = jsSID.ReSID.EnvelopeGenerator.State.RELEASE;
	this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	this.hold_zero = true;
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeCONTROL_REG = function(control) {
	var gate_next = control & 0x01;
	if (!this.gate && gate_next) {
		this.state = jsSID.ReSID.EnvelopeGenerator.State.ATTACK;
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.attack];
		this.hold_zero = false;
	} else if (this.gate && !gate_next) {
		this.state = jsSID.ReSID.EnvelopeGenerator.State.RELEASE;
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	}
	this.gate = gate_next;
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeATTACK_DECAY = function(attack_decay) {
	this.attack = (attack_decay >> 4) & 0x0f;
	this.decay = attack_decay & 0x0f;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.ATTACK) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.attack];
	} else if (this.state == jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.decay];
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.writeSUSTAIN_RELEASE = function(sustain_release) {
	this.sustain = (sustain_release >> 4) & 0x0f;
	this.release = sustain_release & 0x0f;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.RELEASE) {
		this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.release];
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.readENV = function() {
	return this.output();
};

jsSID.ReSID.EnvelopeGenerator.prototype.output = function() {
	return this.envelope_counter;
};

// definitions of EnvelopeGenerator methods below here are called for every sample
jsSID.ReSID.EnvelopeGenerator.prototype.clock_one = function() {
	if (++this.rate_counter & 0x8000) {
		++this.rate_counter;
		this.rate_counter &= 0x7fff;
	}
	if (this.rate_counter != this.rate_period) {
		return;
	}
	this.clock_common();
};

jsSID.ReSID.EnvelopeGenerator.prototype.clock_delta = function(delta_t) {
	var rate_step = this.rate_period - this.rate_counter;
	if (rate_step <= 0) {
		rate_step += 0x7fff;
	}
	while (delta_t) {
		if (delta_t < rate_step) {
			this.rate_counter += delta_t;
			if (this.rate_counter & 0x8000) {
				++this.rate_counter;
				this.rate_counter &= 0x7fff;
			}
			return;
		}

		delta_t -= rate_step;

		this.clock_common();

		rate_step = this.rate_period;
	}

};

// FIXME: this is part of the fast path, maybe factoring it out was not the best?
jsSID.ReSID.EnvelopeGenerator.prototype.clock_common = function() {
	this.rate_counter = 0;
	if (this.state == jsSID.ReSID.EnvelopeGenerator.State.ATTACK || ++this.exponential_counter == this.exponential_counter_period) {
		this.exponential_counter = 0;
		if (this.hold_zero) {
			return;
		}
		switch (this.state) {
			case jsSID.ReSID.EnvelopeGenerator.State.ATTACK:
				++this.envelope_counter;
				this.envelope_counter &= 0xff;
				if (this.envelope_counter == 0xff) {
					this.state = jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN;
					this.rate_period = jsSID.ReSID.EnvelopeGenerator.rate_counter_period[this.decay];
				}
				break;
			case jsSID.ReSID.EnvelopeGenerator.State.DECAY_SUSTAIN:
				if (this.envelope_counter != jsSID.ReSID.EnvelopeGenerator.sustain_level[this.sustain]) {
					--this.envelope_counter;
					this.envelope_counter &= 0xff;
				}
				break;
			case jsSID.ReSID.EnvelopeGenerator.State.RELEASE:
				--this.envelope_counter;
				this.envelope_counter &= 0xff;
				break;
		}
		this.set_exponential_counter();
	}
};

jsSID.ReSID.EnvelopeGenerator.prototype.set_exponential_counter = function() {
	switch (this.envelope_counter) {
		case 0xff:
			this.exponential_counter_period = 1;
			break;
		case 0x5d:
			this.exponential_counter_period = 2;
			break;
		case 0x36:
			this.exponential_counter_period = 4;
			break;
		case 0x1a:
			this.exponential_counter_period = 8;
			break;
		case 0x0e:
			this.exponential_counter_period = 16;
			break;
		case 0x06:
			this.exponential_counter_period = 30;
			break;
		case 0x00:
			this.exponential_counter_period = 1;
			this.hold_zero = true;
			break;
	}
};

// Waveform object
jsSID.ReSID.WaveformGenerator = function() {
	this.sync_source = this;
	this.set_chip_model(jsSID.chip.model.MOS6581);
	this.reset();
}

jsSID.ReSID.WaveformGenerator.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.wave__ST = jsSID.ReSID.WaveformGenerator.comboTable.wave6581__ST;
		this.wave_P_T = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_P_T;
		this.wave_PS_ = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_PS_;
		this.wave_PST = jsSID.ReSID.WaveformGenerator.comboTable.wave6581_PST;
	} else {
		this.wave__ST = jsSID.ReSID.WaveformGenerator.comboTable.wave8580__ST;
		this.wave_P_T = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_P_T;
		this.wave_PS_ = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_PS_;
		this.wave_PST = jsSID.ReSID.WaveformGenerator.comboTable.wave8580_PST;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.reset = function() {
	this.accumulator = 0;
	this.shift_register = 0x7ffff8;
	this.freq = 0;
	this.waveform = 0;
	this.pw = 0;
	this.test = 0;
	this.ring_mod = 0;
	this.sync = 0;
	this.msb_rising = false;
};

jsSID.ReSID.WaveformGenerator.prototype.set_sync_source = function(source) {
	this.sync_source = source;
	source.sync_dest = this;
};

jsSID.ReSID.WaveformGenerator.prototype.writeFREQ_LO = function(freq_lo) {
	this.freq = (this.freq & 0xff00) | (freq_lo & 0x00ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writeFREQ_HI = function(freq_hi) {
	this.freq = ((freq_hi << 8) & 0xff00) | (this.freq & 0x00ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writePW_LO = function(pw_lo) {
	this.pw = (this.pw & 0xf00) | (pw_lo & 0x0ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writePW_HI = function(pw_hi) {
	this.pw = ((pw_hi << 8) & 0xf00) | (this.pw & 0x0ff);
};

jsSID.ReSID.WaveformGenerator.prototype.writeCONTROL_REG = function(control) {
	this.waveform = (control >> 4) & 0x0f;
	this.ring_mod = control & 0x04;
	this.sync = control & 0x02;
	var test_next = control & 0x08;
	if (test_next) {
		this.accumulator = 0;
		this.shift_register = 0;
	} else if (this.test) {
		this.shift_register = 0x7ffff8;
	}
	this.test = test_next;
};

jsSID.ReSID.WaveformGenerator.prototype.readOSC = function() {
	return this.output() >> 4;
};

// definitions of EnvelopeGenerator methods below here are called for every sample
jsSID.ReSID.WaveformGenerator.prototype.clock_one = function() {
	if (this.test) {
		return;
	}
	var accumulator_prev = this.accumulator;
	this.accumulator += this.freq;
	this.accumulator &= 0xffffff;
	this.msb_rising = !(accumulator_prev & 0x800000) && (this.accumulator & 0x800000);
	if (!(accumulator_prev & 0x080000) && (this.accumulator & 0x080000)) {
		var bit0 = ((this.shift_register >> 22) ^ (this.shift_register >> 17)) & 0x1;
		this.shift_register <<= 1;
		this.shift_register &= 0x7fffff;
		this.shift_register |= bit0;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.clock_delta = function(delta_t) {
	if (this.test) {
		return;
	}
	var accumulator_prev = this.accumulator;
	var delta_accumulator = delta_t * this.freq;
	this.accumulator += delta_accumulator;
	this.accumulator &= 0xffffff;
	this.msb_rising = !(accumulator_prev & 0x800000) && (this.accumulator & 0x800000);
	var shift_period = 0x100000;
	while (delta_accumulator) {
		if (delta_accumulator < shift_period) {
			shift_period = delta_accumulator;
			if (shift_period <= 0x080000) {
				if (((this.accumulator - shift_period) & 0x080000) || !(this.accumulator & 0x080000)) {
					break;
				}
			} else {
				if (((this.accumulator - shift_period) & 0x080000) && !(this.accumulator & 0x080000)) {
					break;
				}
			}
		}

		var bit0 = ((this.shift_register >> 22) ^ (this.shift_register >> 17)) & 0x1;
		this.shift_register <<= 1;
		this.shift_register &= 0x7fffff;
		this.shift_register |= bit0;

		delta_accumulator -= shift_period;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.synchronize = function() {
	if (this.msb_rising && this.sync_dest.sync && !(this.sync && this.sync_source.msb_rising)) {
		this.sync_dest.accumulator = 0;
	}
};

jsSID.ReSID.WaveformGenerator.prototype.output____ = function() {
	return 0x000;
};

jsSID.ReSID.WaveformGenerator.prototype.output___T = function() {
	var msb = (this.ring_mod ? this.accumulator ^ this.sync_source.accumulator : this.accumulator) & 0x800000;
	// FIXME: may need to mask inversion here
	return ((msb ? ~this.accumulator : this.accumulator) >> 11) & 0xfff;
};

jsSID.ReSID.WaveformGenerator.prototype.output__S_ = function() {
	return this.accumulator >> 12;
};

jsSID.ReSID.WaveformGenerator.prototype.output_P__ = function() {
	return (this.test || (this.accumulator >> 12) >= this.pw) ? 0xfff : 0x000;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN___ = function() {
	return  ((this.shift_register & 0x400000) >> 11) |
		((this.shift_register & 0x100000) >> 10) |
		((this.shift_register & 0x010000) >> 7) |
		((this.shift_register & 0x002000) >> 5) |
		((this.shift_register & 0x000800) >> 4) |
		((this.shift_register & 0x000080) >> 1) |
		((this.shift_register & 0x000010) << 1) |
		((this.shift_register & 0x000004) << 2);
};


jsSID.ReSID.WaveformGenerator.prototype.output__ST = function() {
	return this.wave__ST[this.output__S_()] << 4;
};

jsSID.ReSID.WaveformGenerator.prototype.output_P_T = function() {
	return (this.wave_P_T[this.output___T() >> 1] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.output_PS_ = function() {
	return (this.wave_PS_[this.output__S_()] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.output_PST = function() {
	return (this.wave_PST[this.output__S_()] << 4) & this.output_P__();
};

jsSID.ReSID.WaveformGenerator.prototype.outputN__T = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN_S_ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputN_ST = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNP__ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNP_T = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNPS_ = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.outputNPST = function() {
	return 0;
};

jsSID.ReSID.WaveformGenerator.prototype.output = function() {
	switch(this.waveform) {
		default:
		case 0x0:
			return this.output____();
		case 0x1:
			return this.output___T();
		case 0x2:
			return this.output__S_();
		case 0x3:
			return this.output__ST();
		case 0x4:
			return this.output_P__();
		case 0x5:
			return this.output_P_T();
		case 0x6:
			return this.output_PS_();
		case 0x7:
			return this.output_PST();
		case 0x8:
			return this.outputN___();
		case 0x9:
			return this.outputN__T();
		case 0xa:
			return this.outputN_S_();
		case 0xb:
			return this.outputN_ST();
		case 0xc:
			return this.outputNP__();
		case 0xd:
			return this.outputNP_T();
		case 0xe:
			return this.outputNPS_();
		case 0xf:
			return this.outputNPST();
	}
};

jsSID.ReSID.WaveformGenerator.comboTableCompressed = 
	"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" +
	"iID/ATiBVooAgAAA";

// expand/split tables
jsSID.ReSID.WaveformGenerator.comboTable = function() {
	var data = JXG.decompress(jsSID.ReSID.WaveformGenerator.comboTableCompressed);
	var stream = Stream(data);
	var names = [
		"wave6581__ST", "wave6581_P_T", "wave6581_PS_", "wave6581_PST",
		"wave8580__ST", "wave8580_P_T", "wave8580_PS_", "wave8580_PST"
	];
	var ret = {};
	// 8 tables
	for(var i = 0; i < 8; i++) {
		var table = new Array(4096);
		for(var j = 0; j < 4096; j++) {
			table[j] = stream.readInt8();
		}
		ret[names[i]] = table;
	}
	return ret;
}();


// Voice class
jsSID.ReSID.Voice = function() {
	this.muted = false;
	this.wave_zero = 0;
	this.voice_DC = 0;

	this.envelope = new jsSID.ReSID.EnvelopeGenerator();
	this.wave = new jsSID.ReSID.WaveformGenerator();
	this.set_chip_model(jsSID.chip.model.MOS6581);
};


jsSID.ReSID.Voice.prototype.set_chip_model = function(model) {
	this.wave.set_chip_model(model);
	if (model == jsSID.chip.model.MOS6581) {
		this.wave_zero = 0x380;
		this.voice_DC = 0x800*0xff;
	} else {
		this.wave_zero = 0x800;
		this.voice_DC = 0;
	}
};

jsSID.ReSID.Voice.prototype.set_sync_source = function(source) {
	this.wave.set_sync_source(source.wave);
};

jsSID.ReSID.Voice.prototype.writeCONTROL_REG = function(control) {
	this.wave.writeCONTROL_REG(control);
	this.envelope.writeCONTROL_REG(control);
};

jsSID.ReSID.Voice.prototype.reset = function() {
	this.wave.reset();
	this.envelope.reset();
};

jsSID.ReSID.Voice.prototype.mute = function(enable) {
	this.muted = enable;
};


// definitions of Voice methods below here are called for every sample
jsSID.ReSID.Voice.prototype.output = function() {
	if (!this.muted) {
		return (this.wave.output() - this.wave_zero) * this.envelope.output() + this.voice_DC;
	} else {
		return 0;
	}
};


// ExternalFilter class
jsSID.ReSID.ExternalFilter = function() {
	this.reset();
	this.enabled = true;
	this.set_sampling_parameter(15915.6);
	this.set_chip_model(jsSID.chip.model.MOS6581);
};

jsSID.ReSID.ExternalFilter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
};


jsSID.ReSID.ExternalFilter.prototype.set_sampling_parameter = function(pass_freq) {
	this.w0hp = 105;
	this.w0lp = pass_freq * (2.0 * Math.PI * 1.048576);
	if (this.w0lp > 104858) {
		this.w0lp = 104858;
	}

};

jsSID.ReSID.ExternalFilter.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.mixer_DC = ((((0x800 - 0x380) + 0x800)*0xff*3 - 0xfff*0xff/18) >> 7)*0x0f;
	} else {
		this.mixer_DC = 0;
	}
};


jsSID.ReSID.ExternalFilter.prototype.reset = function() {
	this.Vlp = 0;
	this.Vhp = 0;
	this.Vo = 0;
};


// definitions of ExternalFilter methods below here are called for every sample


jsSID.ReSID.ExternalFilter.prototype.clock_one = function(Vi) {
	if (!this.enabled) {
		this.Vlp = 0;
		this.Vhp = 0;
		this.Vo = Vi - this.mixer_DC;
		return;
	}

	var dVlp = (this.w0lp >> 8) * (Vi - this.Vlp) >> 12;
	var dVhp = this.w0hp * (this.Vlp - this.Vhp) >> 20;
	this.Vo = this.Vlp - this.Vhp;
	this.Vlp += dVlp;
	this.Vhp += dVhp;

};


jsSID.ReSID.ExternalFilter.prototype.clock_delta = function(Vi, delta_t) {
	if (!this.enabled) {
		this.Vlp = 0;
		this.Vhp = 0;
		this.Vo = Vi - this.mixer_DC;
		return;
	}
	var delta_t_flt = 8;
	while (delta_t) {
		if (delta_t < delta_t_flt) {
			delta_t_flt = delta_t;
		}
		var dVlp = (this.w0lp * delta_t_flt >> 8) * (Vi - this.Vlp) >> 12;
		var dVhp = this.w0hp * delta_t_flt * (this.Vlp - this.Vhp) >> 20;
		this.Vo = this.Vlp - this.Vhp;
		this.Vlp += dVlp;
		this.Vhp += dVhp;
		delta_t -= delta_t_flt;
	}
};


jsSID.ReSID.ExternalFilter.prototype.output = function() {
	return this.Vo;
};


// constructor, no.. just a collection of functions for now
jsSID.ReSID.PointPlotter = {};

jsSID.ReSID.PointPlotter.interpolate = function(inP, plot, res) {
	var k1, k2;
	var p0 = 0;
	var p1 = 1;
	var p2 = 2;
	var p3 = 3;
	var pn = inP.length - 1;

	for (; p2 != pn; ++p0, ++p1, ++p2, ++p3) {
		if (inP[p1][0] == inP[p2][0]) {
			continue;
		}
		if (inP[p0][0] == inP[p1][0] && inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]);
			k2 = k1;
		} else if (inP[p0][0] == inP[p1][0]) {
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
			k1 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k2) / 2;
		} else if (inP[p2][0] == inP[p3][0]) {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (3 * (inP[p2][1] - inP[p1][1]) / (inP[p2][0] - inP[p1][0]) - k1) / 2;
		} else {
			k1 = (inP[p2][1] - inP[p0][1]) / (inP[p2][0] - inP[p0][0]);
			k2 = (inP[p3][1] - inP[p1][1]) / (inP[p3][0] - inP[p1][0]);
		}
		jsSID.ReSID.PointPlotter.interpolate_segment(inP[p1][0], inP[p1][1], inP[p2][0], inP[p2][1], k1, k2, plot, res);
	}


};

jsSID.ReSID.PointPlotter.cubic_coefficients = function(x1, y1, x2, y2, k1, k2) {
	var dx = x2 - x1;
	var dy = y2 - y1;
	var a = ((k1 + k2) - 2 * dy / dx) / (dx * dx);
	var b = ((k2 - k1) / dx - 3 * (x1 + x2) * a) / 2;
	var c = k1 - (3 * x1 * a + 2 * b) * x1;
	var d = y1 - ((x1 * a + b) * x1 + c) * x1;
	return new Object({ a: a, b: b, c: c, d: d });
};

jsSID.ReSID.PointPlotter.interpolate_brute_force = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = jsSID.ReSID.PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	for (var x = x1; x <= x2; x += res) {
		var y = ((cc.a * x + cc.b) * x + cc.c) * x + cc.d;
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
	}
};


jsSID.ReSID.PointPlotter.interpolate_forward_difference = function(x1, y1, x2, y2, k1, k2, plot, res) {
	var cc = jsSID.ReSID.PointPlotter.cubic_coefficients(x1, y1, x2, y2, k1, k2);
	var y = ((cc.a * x1 + cc.b) * x1 + cc.c) * x1 + cc.d;
	var dy = (3 * cc.a * (x1 + res) + 2 * cc.b) * x1 * res + ((cc.a * res + cc.b) * res + cc.c) * res;
	var d2y = (6 * cc.a * (x1 + res) + 2 * cc.b) * res * res;
	var d3y = 6 * cc.a * res * res * res;
	for (var x = x1; x <= x2; x += res) {
		//plot[x] = (y < 0) ? 0 : y;
		plot[Math.floor(x)] = ((y < 0) ? 0 : y) + 0.5;
		y += dy;
		dy += d2y;
		d2y += d3y;
	}
};

jsSID.ReSID.PointPlotter.spline_brute_force = false;

jsSID.ReSID.PointPlotter.interpolate_segment = 
	jsSID.ReSID.PointPlotter.spline_brute_force ?
	jsSID.ReSID.PointPlotter.interpolate_brute_force :
	jsSID.ReSID.PointPlotter.interpolate_forward_difference;


// Filter class
jsSID.ReSID.Filter = function() {
	this.fc = 0;
	this.res = 0;
	this.filt = 0;
	this.voice3off = 0;
	this.hp_bp_lp = 0;
	this.vol = 0;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vlp = 0;
	this.Vnf = 0;
	this.enabled = true;
	this.w0 = 0;
	this.w0_ceil_1 = 0;
	this.w0_ceil_dt = 0;
	this.mixerDC = 0;

	this.f0_6581 = new Array(2048);
	this.f0_8580 = new Array(2048);
	// Create mappings from FC to cutoff frequency.
	jsSID.ReSID.PointPlotter.interpolate(jsSID.ReSID.Filter.f0_points_6581, this.f0_6581, 1.0);
	jsSID.ReSID.PointPlotter.interpolate(jsSID.ReSID.Filter.f0_points_8580, this.f0_8580, 1.0);

	this.set_chip_model(jsSID.chip.model.MOS6581);
};

jsSID.ReSID.Filter.f0_points_6581 = new Array(
	[    0,   220 ], [    0,   220 ], [  128,   230 ], [  256,   250 ],
	[  384,   300 ], [  512,   420 ], [  640,   780 ], [  768,  1600 ],
	[  832,  2300 ], [  896,  3200 ], [  960,  4300 ], [  992,  5000 ],
	[ 1008,  5400 ], [ 1016,  5700 ], [ 1023,  6000 ], [ 1023,  6000 ],
	[ 1024,  4600 ], [ 1024,  4600 ], [ 1032,  4800 ], [ 1056,  5300 ],
	[ 1088,  6000 ], [ 1120,  6600 ], [ 1152,  7200 ], [ 1280,  9500 ],
	[ 1408, 12000 ], [ 1536, 14500 ], [ 1664, 16000 ], [ 1792, 17100 ],
	[ 1920, 17700 ], [ 2047, 18000 ], [ 2047, 18000 ]
);

jsSID.ReSID.Filter.f0_points_8580 = new Array(
	[    0,     0 ], [    0,     0 ], [  128,   800 ], [  256,  1600 ],
	[  384,  2500 ], [  512,  3300 ], [  640,  4100 ], [  768,  4800 ],
	[  896,  5600 ], [ 1024,  6500 ], [ 1152,  7500 ], [ 1280,  8400 ],
	[ 1408,  9200 ], [ 1536,  9800 ], [ 1664, 10500 ], [ 1792, 11000 ],
	[ 1920, 11700 ], [ 2047, 12500 ], [ 2047, 12500 ]
);

jsSID.ReSID.Filter.prototype.enable_filter = function(enable) {
	this.enabled = enable;
};

jsSID.ReSID.Filter.prototype.set_chip_model = function(model) {
	if (model == jsSID.chip.model.MOS6581) {
		this.mixer_DC = -0xfff*0xff/18 >> 7;
		this.f0 = this.f0_6581;
		this.f0_points = jsSID.ReSID.Filter.f0_points_6581;
	} else {
		this.mixer_DC = 0;
		this.f0 = this.f0_8580;
		this.f0_points = jsSID.ReSID.Filter.f0_points_8580;
	}
	this.f0_count = this.f0_points.length;
	this.set_w0();
	this.set_Q();
};

jsSID.ReSID.Filter.prototype.reset = function() {
	this.fc = 0;
	this.res = 0;
	this.filt = 0;
	this.voice3off = 0;
	this.hp_bp_lp = 0;
	this.vol = 0;
	this.Vhp = 0;
	this.Vbp = 0;
	this.Vlp = 0;
	this.Vnf = 0;


	this.set_w0();
	this.set_Q();
};

jsSID.ReSID.Filter.prototype.writeFC_LO = function(fc_lo) {
	this.fc = (this.fc & 0x7f8) | (fc_lo & 0x007);
	this.set_w0();
};

jsSID.ReSID.Filter.prototype.writeFC_HI = function(fc_hi) {
	this.fc = ((fc_hi << 3) & 0x7f8) | (this.fc & 0x007);
	this.set_w0();
};

jsSID.ReSID.Filter.prototype.writeRES_FILT = function(res_filt) {
	this.res = (res_filt >> 4) & 0x0f;
	this.set_Q();
	this.filt = res_filt & 0x0f;
};

jsSID.ReSID.Filter.prototype.writeMODE_VOL = function(mode_vol) {
	this.voice3off = mode_vol & 0x80;
	this.hp_bp_lp = (mode_vol >> 4) & 0x07;
	this.vol = mode_vol & 0x0f;
};

jsSID.ReSID.Filter.prototype.set_w0 = function() {
	this.w0 = 2 * Math.PI * this.f0[this.fc] * 1.048576;

	// FIXME: move these to be const
	var w0_max_1 = 2 * Math.PI * 16000 * 1.048576;
	var w0_max_dt = 2 * Math.PI * 4000 * 1.048576;

	this.w0_ceil_1 = this.w0 <= w0_max_1 ? this.w0 : w0_max_1;
	this.w0_ceil_dt = this.w0 <= w0_max_dt ? this.w0 : w0_max_dt;
};

jsSID.ReSID.Filter.prototype.set_Q = function() {
	this._1024_div_Q = 1024.0 / (0.707 + 1.0 * this.res / 0x0f);
};


// definitions of Filter methods below here are called for every sample


jsSID.ReSID.Filter.prototype.clock_one = function(voice1, voice2, voice3, ext_in) {
	voice1 >>= 7;
	voice2 >>= 7;
	if (this.voice3off && !(this.filt & 0x04)) {
		voice3 = 0;
	} else {
		voice3 >>= 7;
	}
	ext_in >>= 7;

	if (!this.enabled) {
		this.Vnf = voice1 + voice2 + voice3 + ext_in;
		this.Vhp = 0;
		this.Vbp = 0;
		this.Vlp = 0;
		return;
	}


	var Vi;
	switch (this.filt) {
		default:
		case 0x0:
			Vi = 0;
			this.Vnf = voice1 + voice2 + voice3 + ext_in;
			break;
		case 0x1:
			Vi = voice1;
			this.Vnf = voice2 + voice3 + ext_in;
			break;
		case 0x2:
			Vi = voice2;
			this.Vnf = voice1 + voice3 + ext_in;
			break;
		case 0x3:
			Vi = voice1 + voice2;
			this.Vnf = voice3 + ext_in;
			break;
		case 0x4:
			Vi = voice3;
			this.Vnf = voice1 + voice2 + ext_in;
			break;
		case 0x5:
			Vi = voice1 + voice3;
			this.Vnf = voice2 + ext_in;
			break;
		case 0x6:
			Vi = voice2 + voice3;
			this.Vnf = voice1 + ext_in;
			break;
		case 0x7:
			Vi = voice1 + voice2 + voice3;
			this.Vnf = ext_in;
			break;
		case 0x8:
			Vi = ext_in;
			this.Vnf = voice1 + voice2 + voice3;
			break;
		case 0x9:
			Vi = voice1 + ext_in;
			this.Vnf = voice2 + voice3;
			break;
		case 0xa:
			Vi = voice2 + ext_in;
			this.Vnf = voice1 + voice3;
			break;
		case 0xb:
			Vi = voice1 + voice2 + ext_in;
			this.Vnf = voice3;
			break;
		case 0xc:
			Vi = voice3 + ext_in;
			this.Vnf = voice1 + voice2;
			break;
		case 0xd:
			Vi = voice1 + voice3 + ext_in;
			this.Vnf = voice2;
			break;
		case 0xe:
			Vi = voice2 + voice3 + ext_in;
			this.Vnf = voice1;
			break;
		case 0xf:
			Vi = voice1 + voice2 + voice3 + ext_in;
			this.Vnf = 0;
			break;
	}
	var dVbp = (this.w0_ceil_1 * this.Vhp >> 20);
	var dVlp = (this.w0_ceil_1 * this.Vbp >> 20);
	this.Vbp -= dVbp;
	this.Vlp -= dVlp;
	this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
};

jsSID.ReSID.Filter.prototype.clock_delta = function(voice1, voice2, voice3, ext_in, delta_t) {
	voice1 >>= 7;
	voice2 >>= 7;
	if (this.voice3off && !(this.filt & 0x04)) {
		voice3 = 0;
	} else {
		voice3 >>= 7;
	}
	ext_in >>= 7;

	if (!this.enabled) {
		this.Vnf = voice1 + voice2 + voice3 + ext_in;
		this.Vhp = 0;
		this.Vbp = 0;
		this.Vlp = 0;
		return;
	}


	var Vi;
	switch (this.filt) {
		default:
		case 0x0:
			Vi = 0;
			this.Vnf = voice1 + voice2 + voice3 + ext_in;
			break;
		case 0x1:
			Vi = voice1;
			this.Vnf = voice2 + voice3 + ext_in;
			break;
		case 0x2:
			Vi = voice2;
			this.Vnf = voice1 + voice3 + ext_in;
			break;
		case 0x3:
			Vi = voice1 + voice2;
			this.Vnf = voice3 + ext_in;
			break;
		case 0x4:
			Vi = voice3;
			this.Vnf = voice1 + voice2 + ext_in;
			break;
		case 0x5:
			Vi = voice1 + voice3;
			this.Vnf = voice2 + ext_in;
			break;
		case 0x6:
			Vi = voice2 + voice3;
			this.Vnf = voice1 + ext_in;
			break;
		case 0x7:
			Vi = voice1 + voice2 + voice3;
			this.Vnf = ext_in;
			break;
		case 0x8:
			Vi = ext_in;
			this.Vnf = voice1 + voice2 + voice3;
			break;
		case 0x9:
			Vi = voice1 + ext_in;
			this.Vnf = voice2 + voice3;
			break;
		case 0xa:
			Vi = voice2 + ext_in;
			this.Vnf = voice1 + voice3;
			break;
		case 0xb:
			Vi = voice1 + voice2 + ext_in;
			this.Vnf = voice3;
			break;
		case 0xc:
			Vi = voice3 + ext_in;
			this.Vnf = voice1 + voice2;
			break;
		case 0xd:
			Vi = voice1 + voice3 + ext_in;
			this.Vnf = voice2;
			break;
		case 0xe:
			Vi = voice2 + voice3 + ext_in;
			this.Vnf = voice1;
			break;
		case 0xf:
			Vi = voice1 + voice2 + voice3 + ext_in;
			this.Vnf = 0;
			break;
	}

	var delta_t_flt = 8;
	while (delta_t) {
		if (delta_t < delta_t_flt) {
			delta_t_flt = delta_t;
		}
		var w0_delta_t = this.w0_ceil_dt * delta_t_flt >> 6;
		var dVbp = w0_delta_t * this.Vhp >> 14;
		var dVlp = w0_delta_t * this.Vbp >> 14;
		this.Vbp -= dVbp;
		this.Vlp -= dVlp;
		this.Vhp = (this.Vbp * this._1024_div_Q >> 10) - this.Vlp - Vi;
		delta_t -= delta_t_flt;
	}
};


jsSID.ReSID.Filter.prototype.output = function() {
	if (!this.enabled) {
		return (this.Vnf + this.mixer_DC) * this.vol;
	}
	var Vf;
	switch (this.hp_bp_lp) {
		default:
		case 0x0:
			Vf = 0;
			break;
		case 0x1:
			Vf = this.Vlp;
			break;
		case 0x2:
			Vf = this.Vbp;
			break;
		case 0x3:
			Vf = this.Vlp + this.Vbp;
			break;
		case 0x4:
			Vf = this.Vhp;
			break;
		case 0x5:
			Vf = this.Vlp + this.Vhp;
			break;
		case 0x6:
			Vf = this.Vbp + this.Vhp;
			break;
		case 0x7:
			Vf = this.Vlp + this.Vbp + this.Vhp;
			break;
	}
	return (this.Vnf + Vf + this.mixer_DC) * this.vol;
};


jsSID.ReSID.sampling_method = Object.freeze({
	SAMPLE_FAST: {},
	SAMPLE_INTERPOLATE: {},
	SAMPLE_RESAMPLE_INTERPOLATE: {},
	SAMPLE_RESAMPLE_FAST: {}
});

jsSID.ReSID.prototype.set_chip_model = function(model) {
	for (var i = 0; i < 3; i++) {
		this.voice[i].set_chip_model(model);
	}

	this.filter.set_chip_model(model);
	this.extfilt.set_chip_model(model);
};

jsSID.ReSID.prototype.reset = function() {
	for (var i = 0; i < 3; i++) {
		this.voice[i].reset();
	}
	this.filter.reset();
	this.extfilt.reset();
	this.bus_value = 0;
	this.bus_value_ttl = 0;
};

jsSID.ReSID.prototype.input = function(sample) {
	this.ext_in = (sample << 4) * 3;
};


jsSID.ReSID.prototype.output = function(bits) {
	if(!bits) {
		bits = 16;
	}
	var range = 1 << bits;
	var half = range >> 1;
	var sample = this.extfilt.output()  /((4095 * 255 >> 7) * 3 * 15 * 2 / range);
	if (sample >= half) {
		return half - 1;
	}
	if (sample < -half) {
		return -half;
	}
	return sample;
};


jsSID.ReSID.prototype.read = function(offset) {
	switch (offset) {
			// We don't model the potentiometers
		case 0x19:
		case 0x1a:
			return 0xFF;
		case 0x1b:
			return this.voice[2].wave.readOSC();
		case 0x1c:
			return this.voice[2].envelope.readENV();
		default:
			return this.bus_value;
	}
};

jsSID.ReSID.prototype.poke = function(offset, value) {
	this.write(offset, value);
};

jsSID.ReSID.prototype.pokeDigi = function(offset, value) {
	// not yet implemented
	return;
};

jsSID.ReSID.prototype.write = function(offset, value) {
	this.bus_value = value;
	this.bus_value_ttl = 0x2000;

	switch (offset) {
		case 0x00:
			this.voice[0].wave.writeFREQ_LO(value);
			break;
		case 0x01:
			this.voice[0].wave.writeFREQ_HI(value);
			break;
		case 0x02:
			this.voice[0].wave.writePW_LO(value);
			break;
		case 0x03:
			this.voice[0].wave.writePW_HI(value);
			break;
		case 0x04:
			this.voice[0].writeCONTROL_REG(value);
			break;
		case 0x05:
			this.voice[0].envelope.writeATTACK_DECAY(value);
			break;
		case 0x06:
			this.voice[0].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x07:
			this.voice[1].wave.writeFREQ_LO(value);
			break;
		case 0x08:
			this.voice[1].wave.writeFREQ_HI(value);
			break;
		case 0x09:
			this.voice[1].wave.writePW_LO(value);
			break;
		case 0x0a:
			this.voice[1].wave.writePW_HI(value);
			break;
		case 0x0b:
			this.voice[1].writeCONTROL_REG(value);
			break;
		case 0x0c:
			this.voice[1].envelope.writeATTACK_DECAY(value);
			break;
		case 0x0d:
			this.voice[1].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x0e:
			this.voice[2].wave.writeFREQ_LO(value);
			break;
		case 0x0f:
			this.voice[2].wave.writeFREQ_HI(value);
			break;
		case 0x10:
			this.voice[2].wave.writePW_LO(value);
			break;
		case 0x11:
			this.voice[2].wave.writePW_HI(value);
			break;
		case 0x12:
			this.voice[2].writeCONTROL_REG(value);
			break;
		case 0x13:
			this.voice[2].envelope.writeATTACK_DECAY(value);
			break;
		case 0x14:
			this.voice[2].envelope.writeSUSTAIN_RELEASE(value);
			break;
		case 0x15:
			this.filter.writeFC_LO(value);
			break;
		case 0x16:
			this.filter.writeFC_HI(value);
			break;
		case 0x17:
			this.filter.writeRES_FILT(value);
			break;
		case 0x18:
			this.filter.writeMODE_VOL(value);
			break;
		default:
			break;
	}
};


jsSID.ReSID.prototype.mute= function(channel, enable) {
  if (channel >= 3) return;
  this.voice[channel].mute(enable);
};

jsSID.ReSID.prototype.enable_filter = function(enable) {
	this.filter.enable_filter(enable);
};

jsSID.ReSID.prototype.enable_external_filter = function(enable) {
	this.extfilt.enable_filter(enable);
};

jsSID.ReSID.prototype.I0 = function(x) {
	var I0e = 1e-6;			// FIXME: const, used once
	var sum = 1;
	var u = 1;
	var n = 1;
	var halfx = x / 2.0;
	var temp;
	do {
		temp = halfx / n++;
		u *= temp * temp;
		sum += u;
	} while (u >= I0e * sum);
	return sum;
};


// Use a clock freqency of 985248Hz for PAL C64, 1022730Hz for NTSC C64.
jsSID.ReSID.prototype.set_sampling_parameters = function(clock_freq, method, sample_freq, pass_freq, filter_scale) {
	pass_freq = pass_freq || -1;
	filter_scale = filter_scale || 0.97;

	if (method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE || method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST) {
		if (jsSID.ReSID.const.FIR_N * clock_freq / sample_freq >= jsSID.ReSID.const.RINGSIZE) {
			return false;
		}
	}
	if (pass_freq < 0) {
		pass_freq = 20000;
		if (2 * pass_freq / sample_freq >= 0.9) {
			pass_freq = 0.9 * sample_freq / 2;
		}
	} else if (pass_freq > 0.9 * sample_freq / 2) {
		return false;
	}
	if (filter_scale < 0.9 || filter_scale > 1.0) {
		return false;
	}
	this.extfilt.set_sampling_parameter(pass_freq);
	this.clock_frequency = clock_freq;
	this.mix_freq = sample_freq;
	this.sampling = method;
	this.cycles_per_sample = Math.floor(clock_freq / sample_freq * (1 << jsSID.ReSID.const.FIXP_SHIFT) + 0.5);
	this.sample_offset = 0;
	this.sample_prev = 0;

	if (method != jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE && method != jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST) {
		this.sample = null;
		this.fir = null;
		return true;
	}

	var A = -20 * (Math.log(1.0 / (1 << 16)) / Math.LN10);		// FIXME: constant
	var dw = (1 - 2 * pass_freq / sample_freq) * Math.PI;
	var wc = (2 * pass_freq / sample_freq + 1) * Math.PI / 2;
	var beta = 0.1102 * (A - 8.7);			// FIXME: constant
	var I0beta = this.I0(beta);				// FIXME: constant
	var N = Math.floor((A - 7.95) / (2.285 * dw) + 0.5);
	N += N & 1;

	var f_samples_per_cycle = sample_freq / clock_freq;
	var f_cycles_per_sample = clock_freq / sample_freq;
	// FIXME: cast int became floor
	this.fir_N = Math.floor(N * f_cycles_per_sample) + 1;
	this.fir_N |= 1;

	var res = (method == jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE) ? jsSID.ReSID.const.FIR_RES_INTERPOLATE : jsSID.ReSID.const.FIR_RES_FAST;
	var n = Math.ceil(Math.log(res / f_cycles_per_sample) / Math.log(2));
	this.fir_RES = 1 << n;

	this.fir = new Array(this.fir_N * this.fir_RES);

	for (var i = 0; i < this.fir_RES; i++) {
		var fir_offset = i * this.fir_N + this.fir_N / 2;
		// FIXME: i below was cast to double before. should be ok, clean up when confirmed
		var j_offset = i / this.fir_RES;
		for (var j = -this.fir_N / 2; j <= this.fir_N / 2; j++) {
			var jx = j - j_offset;
			var wt = wc * jx / f_cycles_per_sample;
			var temp = jx / (this.fir_N / 2);
			var Kaiser = Math.abs(temp) <= 1 ? this.I0(beta * Math.sqrt(1 - temp * temp)) / I0beta : 0;
			var sincwt = Math.abs(wt) >= 1e-6 ? Math.sin(wt) / wt : 1;
			var val = (1 << jsSID.ReSID.const.FIR_SHIFT) * filter_scale * f_samples_per_cycle * wc / Math.PI * sincwt * Kaiser;
			// FIXME: was a cast to short, convered to Math.floor. Clean once confirmed
			this.fir[fir_offset + j] = Math.floor(val + 0.5);
		}
	}

	// Allocate sample buffer.
	if (!this.sample) {
		this.sample = new Array(jsSID.ReSID.const.RINGSIZE * 2);
	}
	// Clear sample buffer.
	for (var k = 0; k < jsSID.ReSID.const.RINGSIZE * 2; k++) {
		this.sample[k] = 0;
	}
	this.sample_index = 0;
	return true;
};

jsSID.ReSID.prototype.adjust_sampling_frequency = function(sample_freq) {
	// FIXME: casting warning, using floor
	this.cycles_per_sample = Math.floor(this.clock_frequency/sample_freq*(1 << jsSID.ReSID.const.FIXP_SHIFT) + 0.5);
};

jsSID.ReSID.prototype.clock_one = function() {
	var i;
	if (--this.bus_value_ttl <= 0) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.clock_one();
	}
	for (i = 0; i < 3; i++) {
		this.voice[i].wave.synchronize();
	}
	this.filter.clock_one(this.voice[0].output(), this.voice[1].output(), this.voice[2].output(), this.ext_in);
	this.extfilt.clock_one(this.filter.output());
};

jsSID.ReSID.prototype.clock_delta = function(delta_t) {
	var i;
	if (delta_t <= 0) return;

	this.bus_value_ttl -= delta_t;
	if (this.bus_value_ttl <= 0) {
		this.bus_value = 0;
		this.bus_value_ttl = 0;
	}

	// Clock amplitude modulators.
	for (i = 0; i < 3; i++) {
		this.voice[i].envelope.clock_delta(delta_t);
	}

	// Clock and synchronize oscillators.
	// Loop until we reach the current cycle.
	var delta_t_osc = delta_t;
	while (delta_t_osc) {
		var delta_t_min = delta_t_osc;
		for (i = 0; i < 3; i++) {
			var wave = this.voice[i].wave;

			if (!(wave.sync_dest.sync && wave.freq)) {
				continue;
			}

			var freq = wave.freq;
			var accumulator = wave.accumulator;
			var delta_accumulator = (accumulator & 0x800000 ? 0x1000000 : 0x800000) - accumulator;
			var delta_t_next = delta_accumulator/freq;

			if (delta_accumulator % freq) {
				++delta_t_next;
			}

			if (delta_t_next < delta_t_min) {
				delta_t_min = delta_t_next;
			}
		}

		// Clock oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.clock_delta(delta_t_min);
		}

		// Synchronize oscillators.
		for (i = 0; i < 3; i++) {
			this.voice[i].wave.synchronize();
		}

		delta_t_osc -= delta_t_min;
	}

	// Clock filter.
	this.filter.clock_delta(this.voice[0].output(), this.voice[1].output(), this.voice[2].output(), this.ext_in, delta_t);

	// Clock external filter.
	this.extfilt.clock_delta(this.filter.output(), delta_t);

};

// Below here clocking with audio sampling
// Main one here call appropriate type
jsSID.ReSID.prototype.clock = function(delta_t, buf, n, interleave, buf_offset) {
	interleave = interleave || 1;
	buf_offset = buf_offset || 0;
	switch (this.sampling) {
		default:
		case jsSID.ReSID.sampling_method.SAMPLE_FAST:
			return this.clock_fast(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE:
			return this.clock_interpolate(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE:
			return this.clock_resample_interpolate(delta_t, buf, n, interleave, buf_offset);
		case jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST:
			return this.clock_resample_fast(delta_t, buf, n, interleave, buf_offset);
	}
};

jsSID.ReSID.prototype.clock_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample + (1 << (jsSID.ReSID.const.FIXP_SHIFT - 1));
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		this.clock_delta(delta_t_sample);
		delta_t -= delta_t_sample;
		this.sample_offset = (next_sample_offset & jsSID.ReSID.const.FIXP_MASK) - (1 << (jsSID.ReSID.const.FIXP_SHIFT - 1));
		// new sample output w/ offset
		var final_sample = parseFloat(this.output()) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}
	this.clock_delta(delta_t);
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};


jsSID.ReSID.prototype.clock_interpolate = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	var i;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (i = 0; i < delta_t_sample - 1; i++) {
			this.clock_one();
		}
		if (i < delta_t_sample) {
			this.sample_prev = this.output();
			this.clock_one();
		}

		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var sample_now = this.output();
		// new sample output w/ offset
		var final_sample = parseFloat(this.sample_prev + (this.sample_offset * (sample_now - this.sample_prev) >> jsSID.ReSID.const.FIXP_SHIFT)) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
		this.sample_prev = sample_now;
	}

	for (i = 0; i < delta_t - 1; i++) {
		this.clock_one();
	}
	if (i < delta_t) {
		this.sample_prev = this.output();
		this.clock_one();
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;

};


jsSID.ReSID.prototype.clock_resample_interpolate = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= 0x3fff;
		}
		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var fir_offset = this.sample_offset * this.fir_RES >> jsSID.ReSID.const.FIXP_SHIFT;
		var fir_offset_rmd = this.sample_offset * this.fir_RES & jsSID.ReSID.const.FIXP_MASK;
		var fir_start = fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N + jsSID.ReSID.const.RINGSIZE;

		var v1 = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v1 += this.sample[sample_start + j] * this.fir[fir_start + j];
		}

		if (++fir_offset == this.fir_RES) {
			fir_offset = 0;
			--sample_start;
		}
		fir_start = fir_offset * this.fir_N;
	
		var v2 = 0;
		for (var k = 0; k < this.fir_N; k++) {
			v2 += this.sample[sample_start + k] * this.fir[fir_start + k];
		}

		var v = v1 + (fir_offset_rmd * (v2 - v1) >> jsSID.ReSID.const.FIXP_SHIFT);
		v >>= jsSID.ReSID.const.FIR_SHIFT;

		// FIXME constant here
		var half = 1 << 15;
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = parseFloat(v) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}

	for (var m = 0; m < delta_t; m++) {
		this.clock_one();
		this.sample[this.sample_index] = this.output();
		this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
		++this.sample_index;
		this.sample_index &= 0x3fff;
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};

jsSID.ReSID.prototype.clock_resample_fast = function(delta_t, buf, n, interleave, buf_offset) {
	var s = 0;
	for (;;) {
		var next_sample_offset = this.sample_offset + this.cycles_per_sample;
		var delta_t_sample = next_sample_offset >> jsSID.ReSID.const.FIXP_SHIFT;
		if (delta_t_sample > delta_t) {
			break;
		}
		if (s >= n) {
			return s;
		}
		for (var i = 0; i < delta_t_sample; i++) {
			this.clock_one();
			this.sample[this.sample_index] = this.output();
			this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
			++this.sample_index;
			this.sample_index &= 0x3fff;
		}
		delta_t -= delta_t_sample;
		this.sample_offset = next_sample_offset & jsSID.ReSID.const.FIXP_MASK;

		var fir_offset = this.sample_offset * this.fir_RES >> jsSID.ReSID.const.FIXP_SHIFT;
		var fir_start = this.fir_offset * this.fir_N;
		var sample_start = this.sample_index - this.fir_N + jsSID.ReSID.const.RINGSIZE;

		var v = 0;
		for (var j = 0; j < this.fir_N; j++) {
			v += this.sample[sample_start + j] * this.fir[fir_start + j];
		}

		v >>= jsSID.ReSID.const.FIR_SHIFT;

		var half = 1 << 15;			// FIXME: const
		if (v >= half) {
			v = half - 1;
		} else if (v < -half) {
			v = -half;
		}
		// new sample output w/ offset
		var final_sample = parseFloat(v) / 32768;
		var buf_idx = s++ * interleave + buf_offset;
		buf[buf_idx] = final_sample;
	}

	for (var k = 0; k < delta_t; k++) {
		this.clock_one();
		this.sample[this.sample_index] = this.output();
		this.sample[this.sample_index + jsSID.ReSID.const.RINGSIZE] = this.sample[this.sample_index];
		++this.sample_index;
		this.sample_index &= 0x3fff;
	}
	this.sample_offset -= delta_t << jsSID.ReSID.const.FIXP_SHIFT;
	delta_t = 0;
	return s;
};


// generate count samples into buffer at offset
jsSID.ReSID.prototype.generateIntoBuffer = function(count, buffer, offset) {
        //console.log("jsSID.ReSID.generateIntoBuffer (count: " + count + ", offset: " + offset + ")");
        // FIXME: this could be done in one pass. (No?)
        for (var i = offset; i < offset + count; i++) {
                buffer[i] = 0;
        }
	var delta = (this.cycles_per_sample * count) >> jsSID.ReSID.const.FIXP_SHIFT;
	var s = this.clock(delta, buffer, count, 1, offset);
        //console.log("jsSID.ReSID.generateIntoBuffer (delta: " + delta + ", samples clocked: " + s + ")");
	return s;
};

jsSID.ReSID.prototype.generate = function(samples) {
        var data = new Array(samples);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};

// add driver profile(s) to registry:
jsSID.synth.resid_fast = {
        desc: "ReSID - Fast",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_FAST }
};
jsSID.synth.resid_interpolate = {
        desc: "ReSID - Interpolate",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_INTERPOLATE }
};
// Broken vvv
jsSID.synth.resid_resample_fast = {
        desc: "ReSID - Resample/Fast (Broken)",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_FAST }
};
// Broken ^^^
jsSID.synth.resid_resample_interpolate = {
        desc: "ReSID - Resample/Interpolate",
        class: "ReSID",
        opts: { method: jsSID.ReSID.sampling_method.SAMPLE_RESAMPLE_INTERPOLATE }
};


