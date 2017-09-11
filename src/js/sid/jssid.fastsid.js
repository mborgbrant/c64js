
jsSID.FastSID = function(opts) {
	opts = opts || {};
	this.sid_model = opts.model || jsSID.chip.model.MOS6581;
	this.clock_rate = opts.clock || jsSID.chip.clock.PAL;

	// FIXME: expose this
	this.emulate_filter = true;
	//this.emulate_filter = false;

	// FIXME: this is ugly
	this.mix_freq = opts.sampleRate || 44100;
	this.filterRefFreq = 44100;

	this.d = opts.state || new Array(32);		// data registers
	this.cycles_per_sample = Math.floor(this.clock_rate/this.mix_freq * (1 << 16) + 0.5);
	this.init(this.mix_freq, this.clock_rate);
}

jsSID.FastSID.adrtable = [
	1, 4, 8, 12, 19, 28, 34, 40, 50, 125, 250, 400, 500, 1500, 2500, 4000
];
jsSID.FastSID.exptable = [
	0x30000000, 0x1c000000, 0x0e000000, 0x08000000, 0x04000000, 0x00000000
];

jsSID.FastSID.comboTableCompressed =
        "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" +
        "PbnEK4PQRJWDNZ7/WP8CCUeSiwBCAAA=";

jsSID.FastSID.const = Object.freeze({
	NSEED:    0x7ffff8,
	ATTACK:   0,
	DECAY:    1,
	SUSTAIN:  2,
	RELEASE:  3,
	IDLE:     4,
	NOISETABLESIZE: 256
}); 

jsSID.FastSID.prototype.init = function (speed, cycles_per_sec) {
	this.speed1 = Math.floor((cycles_per_sec << 8) / speed);
	this.adrs = new Array(16);
	this.sz = new Array(16);
	var i;
	for (i = 0; i < 16; i++) {
		this.adrs[i] = 500 * 8 * this.speed1 / jsSID.FastSID.adrtable[i];
		this.sz[i] = 0x8888888 * i;
	}
	this.update = 1;

	this.init_filter(speed);
	this.v = new Array(3);
	for (i = 0; i < 3; i++) {
		this.v[i] = { wtr: new Array(2), adsrm: jsSID.FastSID.const.IDLE };
	}
	this.setup_sid();
	this.setup_wavetables();

	for (i = 0; i < 3; i++) {
		this.v[i].vprev = this.v[(i + 2) % 3];
		this.v[i].vnext = this.v[(i + 1) % 3];
		this.v[i].nr = i;
		this.v[i].d_o = i * 7;
		//this.v[i].s = psid;
		this.v[i].rv = jsSID.FastSID.const.NSEED;
		this.v[i].filtLow = 0;
		this.v[i].filtRef = 0;
		this.v[i].filtIO = 0;
		this.v[i].update = 1;
		this.setup_voice(this.v[i]);
	}

	this.noiseMSB = new Array(jsSID.FastSID.const.NOISETABLESIZE);
	this.noiseMID = new Array(jsSID.FastSID.const.NOISETABLESIZE);
	this.noiseLSB = new Array(jsSID.FastSID.const.NOISETABLESIZE);
	for (i = 0; i < jsSID.FastSID.const.NOISETABLESIZE; i++) {
		this.noiseLSB[i] = ((((i >> 5) & 0x04) | ((i >> 3) & 0x02) | ((i >> 2) & 0x01))) & 0xFF;
		this.noiseMID[i] = ((((i >> 1) & 0x10) | ((i << 0) & 0x08))) & 0xFF;
		this.noiseMSB[i] = ((((i << 6) & 0x80) | ((i << 2) & 0x40) | ((i << 5) & 0x20))) & 0xFF;
	}

	//this.sidreadclocks = new Array(9);
	//for (i = 0; i < 9; i++) {
	//	this.sidreadclocks[i] = 13;
	//}

};

jsSID.FastSID.prototype.init_filter = function (freq) {
	var uk;
	var rk;
	var si;
	var yMax = 1.0;
	var yMin = 0.01;
	var resDyMax = 1.0;
	var resDyMin = 2.0;
	var resDy = resDyMin;
	var yAdd, yTmp;
	var filterFs = 400.0;
	var filterFm = 60.0;
	var filterFt = 0.05;
	var filterAmpl = 1.0;

	this.filterValue = 0;
	this.filter_type = 0;
	this.filterCurType = 0;
	this.filterDy = 0;
	this.filterResDy = 0;

	this.lowPassParam = new Array(0x800);
	for (uk = 0, rk = 0; rk < 0x800; rk++, uk++) {
		var h = (((Math.exp(rk / 2048 * Math.log(filterFs)) / filterFm) + filterFt) * this.filterRefFreq) / freq;
		if (h < yMin) {
			h = yMin;
		}
		if (h > yMax) {
			h = yMax;
		}
		this.lowPassParam[uk] = h;
	}

	yMax = 0.22;
	yMin = 0.002;
	yAdd = ((yMax - yMin) / 2048.0);
	yTmp = yMin;

	this.bandPassParam = new Array(0x800);
	for (uk = 0, rk = 0; rk < 0x800; rk++, uk++) {
		this.bandPassParam[uk] = (yTmp * this.filterRefFreq) / freq;
		yTmp += yAdd;
	}

	this.filterResTable = new Array(16);
	for (uk = 0; uk < 16; uk++) {
		this.filterResTable[uk] = resDy;
		resDy -= ((resDyMin - resDyMax ) / 15);
	}

	this.filterResTable[0] = resDyMin;
	this.filterResTable[15] = resDyMax;

	if (this.emulate_filter) {
		this.filterAmpl = 0.7;
	} else {
		this.filterAmpl = 1.0;
	}

	this.ampMod1x8 = new Array(256);
	for (uk = 0, si = 0; si < 256; si++, uk++) {
		this.ampMod1x8[uk] = (si - 0x80) * this.filterAmpl;
	}

};


jsSID.FastSID.prototype.setup_sid = function() {
	if (!this.update) {
		return;
	}
	this.vol = this.d[0x18] & 0x0f;
	this.has3 = (this.d[0x18] & 0x80) && !(this.d[0x17] & 0x04) ? 0 : 1;
	if (this.emulate_filter) {
		this.v[0].filter = (this.d[0x17] & 0x01) ? 1 : 0;
		this.v[1].filter = (this.d[0x17] & 0x02) ? 1 : 0;
		this.v[2].filter = (this.d[0x17] & 0x04) ? 1 : 0;
		this.filter_type = (this.d[0x18] & 0x70);
		if (this.filter_type != this.filterCurType) {
			this.filterCurType = this.filter_type;
			this.v[0].filtLow = 0;
			this.v[0].filtRef = 0;
			this.v[1].filtLow = 0;
			this.v[1].filtRef = 0;
			this.v[2].filtLow = 0;
			this.v[2].filtRef = 0;
		}
		this.filterValue = 0x7ff & ((this.d[0x15] & 7) | (this.d[0x16] << 3));
		if (this.filter_type == 0x20) {
			this.filterDy = this.bandPassParam[this.filterValue];
		} else {
			this.filterDy = this.lowPassParam[this.filterValue];
		}
		this.filterResDy = this.filterResTable[this.d[0x17] >> 4] - this.filterDy;
		if (this.filterResDy < 1.0) {
			this.filterResDy = 1.0;
		}
	} else {
		this.v[0].filter = 0;
		this.v[1].filter = 0;
		this.v[2].filter = 0;
	}
	this.update = 0;

};

jsSID.FastSID.prototype.setup_wavetables = function() {
	this.wavetable00 = new Array(0, 0);
	this.wavetable10 = new Array(4096);
	this.wavetable20 = new Array(4096);
	this.wavetable30 = new Array(4096);
	this.wavetable40 = new Array(8192);
	this.wavetable50 = new Array(8192);
	this.wavetable60 = new Array(8192);
	this.wavetable70 = new Array(8192);

        var data = JXG.decompress(jsSID.FastSID.comboTableCompressed);
        var stream = Stream(data);
	var combo = new Array(4*4096+512);
	var i;
        for(i = 0; i < combo.length; i++) {
		combo[i] = stream.readInt8();
        }

	for(i = 0; i < 4096; i++) {
		this.wavetable10[i] = i < 2048 ? i << 4 : 0xffff - (i << 4);
		this.wavetable20[i] = i << 3;
		this.wavetable30[i] = combo[i] << 7;
		this.wavetable40[i] = 0;
		this.wavetable40[i + 4096] = 0x7fff;
		this.wavetable50[i] = 0;
		this.wavetable60[i] = 0;
		this.wavetable70[i] = 0;
		if (this.sid_model == jsSID.chip.model.MOS8580) {
			this.wavetable50[i + 4096] = combo[i + 4096] << 7;
			this.wavetable60[i + 4096] = combo[i + 8192] << 7;
			this.wavetable70[i + 4096] = combo[i + 12288] << 7;
		} else {
			this.wavetable50[i + 4096] = combo[(i >> 3) + 16384] << 7;
			this.wavetable60[i + 4096] = 0;
			this.wavetable70[i + 4096] = 0;
		}
	}



};

jsSID.FastSID.prototype.setup_voice = function(pv) {
	if (!pv.update) {
		return;
	}
	pv.attack = this.d[pv.d_o + 5] >> 4;
	pv.decay = this.d[pv.d_o + 5] & 0x0f;
	pv.sustain = this.d[pv.d_o + 6] >> 4;
	pv.release = this.d[pv.d_o + 6] & 0x0f;
	pv.sync = this.d[pv.d_o + 4] & 0x02 ? 1 : 0;
	pv.fs = this.speed1 * (this.d[pv.d_o + 0] + this.d[pv.d_o + 1] * 0x100);
	if (this.d[pv.d_o + 4] & 0x08) {
		pv.f = pv.fs = 0;
		pv.rv = jsSID.FastSID.const.NSEED;
	}
	pv.noise = 0;
	pv.wtl = 20;
	pv.wtpf = 0;
	pv.wtr[1] = 0;
	switch ((this.d[pv.d_o + 4] & 0xf0) >> 4) {
		case 0:
			pv.wt = this.wavetable00;
			pv.wt_off = 0;
			pv.wtl = 31;
			break;
		case 1:
			pv.wt = this.wavetable10;
			pv.wt_off = 0;
			if (this.d[pv.d_o + 4] & 0x04) {
				pv.wtr[1] = 0x7fff;
			}
			break;
		case 2:
			pv.wt = this.wavetable20;
			pv.wt_off = 0;
			break;
		case 3:
			pv.wt = this.wavetable30;
			pv.wt_off = 0;
			if (this.d[pv.d_o + 4] & 0x04) {
				pv.wtr[1] = 0x7fff;
			}
			break;
		case 4:
			pv.wt = this.wavetable40;
			if (this.d[pv.d_o + 4] & 0x08) {
				pv.wt_off = 4096;
			} else {
				pv.wt_off = 4096 - (this.d[pv.d_o + 2] + (this.d[pv.d_o + 3] & 0x0f) * 0x100);
			}
			break;
		case 5:
			pv.wt = this.wavetable50;
			pv.wt_off = 4096 - (this.d[pv.d_o + 2] + (this.d[pv.d_o + 3] & 0x0f) * 0x100);
			pv.wtpf = pv.wt_off << 20;
			if (this.d[pv.d_o + 4] & 0x04) {
				pv.wtr[1] = 0x7fff;
			}
			break;
		case 6:
			pv.wt = this.wavetable60;
			pv.wt_off = 4096 - (this.d[pv.d_o + 2] + (this.d[pv.d_o + 3] & 0x0f) * 0x100);
			pv.wtpf = pv.wt_off << 20;
			break;
		case 7:
			pv.wt = this.wavetable70;
			pv.wt_off = 4096 - (this.d[pv.d_o + 2] + (this.d[pv.d_o + 3] & 0x0f) * 0x100);
			pv.wtpf = pv.wt_off << 20;
			if (this.d[pv.d_o + 4] & 0x04 && (this.sid_model == jsSID.chip.model.MOS8580)) {
				pv.wtr[1] = 0x7fff;
			}
			break;
		case 8:
			pv.noise = 1;
			pv.wt = null;
			pv.wt_off = 0;
			pv.wtl = 0;
			break;
		default:
			pv.rv = 0;
			pv.wt = this.wavetable00;
			pv.wt_off = 0;
			pv.wtl = 31;
	}

	switch (pv.adsrm) {
		case jsSID.FastSID.const.ATTACK:
		case jsSID.FastSID.const.DECAY:
		case jsSID.FastSID.const.SUSTAIN:
			if (this.d[pv.d_o + 4] & 0x01) {
				this.set_adsr(pv, (pv.gateflip ? jsSID.FastSID.const.ATTACK : pv.adsrm));
			} else {
				this.set_adsr(pv, jsSID.FastSID.const.RELEASE);
			}
			break;
		case jsSID.FastSID.const.RELEASE:
		case jsSID.FastSID.const.IDLE:
			if (this.d[pv.d_o + 4] & 0x01) {
				this.set_adsr(pv, jsSID.FastSID.const.ATTACK);
			} else {
				this.set_adsr(pv, pv.adsrm);
			}
			break;
	}
	pv.update = 0;
	pv.gateflip = 0;
};

jsSID.FastSID.prototype.set_adsr = function(pv, fm) {
	var i;
	//console.log("setadsr: ", fm);
	switch (fm) {
		case jsSID.FastSID.const.ATTACK:
			pv.adsrs = this.adrs[pv.attack];
			pv.adsrz = 0;
			break;
		case jsSID.FastSID.const.DECAY:
			if ((pv.adsr >>> 0) <= this.sz[pv.sustain]) {
				this.set_adsr(pv, jsSID.FastSID.const.SUSTAIN);
				return;
			}
			for (i = 0; (pv.adsr >>> 0) < jsSID.FastSID.exptable[i]; i++) {}
			pv.adsrs = -this.adrs[pv.decay] >> i;
			pv.adsrz = this.sz[pv.sustain];
			if (jsSID.FastSID.exptable[i] > pv.adsrz) {
				pv.adsrz = jsSID.FastSID.exptable[i];
			}
			break;
		case jsSID.FastSID.const.SUSTAIN:
			if ((pv.adsr >>> 0) > this.sz[pv.sustain]) {
				this.set_adsr(pv, jsSID.FastSID.const.DECAY);
				return;
			}
			pv.adsrs = 0;
			pv.adsrz = 0;
			break;
		case jsSID.FastSID.const.RELEASE:
			if (!pv.adsr) {
				this.set_adsr(pv, jsSID.FastSID.const.IDLE);
				return;
			}
			for (i = 0; (pv.adsr >>> 0) < jsSID.FastSID.exptable[i]; i++) {}
			pv.adsrs = -this.adrs[pv.release] >> i;
			pv.adsrz = jsSID.FastSID.exptable[i];
			break;
		case jsSID.FastSID.const.IDLE:
			pv.adsrs = 0;
			pv.adsrz = 0;
			break;
	}
	pv.adsrm = fm;

};

jsSID.FastSID.prototype.trigger_adsr = function(pv) {
	switch (pv.adsrm) {
		case jsSID.FastSID.const.ATTACK:
			pv.adsr = 0x7fffffff;
			this.set_adsr(pv, jsSID.FastSID.const.DECAY);
			break;
		case jsSID.FastSID.const.DECAY:
		case jsSID.FastSID.const.RELEASE:
			if ((pv.adsr >>> 0) >= 0x80000000) {
				pv.adsr = 0;
			}
			this.set_adsr(pv, pv.adsrm);
			break;
	}
};

jsSID.FastSID.prototype.poke = function(addr, byte) {
	this.store(addr, byte);
};

jsSID.FastSID.prototype.store = function(addr, byte) {
	switch (addr) {
		case 4:
			if ((this.d[addr] ^ byte) & 1) {
				this.v[0].gateflip = 1;
			}
		case 0:
		case 1:
		case 2:
		case 3:
		case 5:
		case 6:
			this.v[0].update = 1;
			break;
		case 11:
			if ((this.d[addr] ^ byte) & 1) {
				this.v[1].gateflip = 1;
			}
		case 7:
		case 8:
		case 9:
		case 10:
		case 12:
		case 13:
			this.v[1].update = 1;
			break;
		case 18:
			if ((this.d[addr] ^ byte) & 1) {
				this.v[2].gateflip = 1;
			}
		case 14:
		case 15:
		case 16:
		case 17:
		case 19:
		case 20:
			this.v[2].update = 1;
			break;
		default:
			this.update = 1;
	}

	this.d[addr] = byte;
	this.laststore = byte;
	this.laststorebit = 8;
	// FIXME: internalizing a main clock.... much todo
	//this.laststoreclk = this.maincpu_clk;

};

// FIXME: reading disabled for now, need to untangle some things from vice to use this
//jsSID.FastSID.prototype.read = function (addr) {
//	var ret;
//	var ffix;
//	var rvstore;
//	var tmp;
//
//	switch (addr) {
//		case 0x19:
//			ret = 0xff;
//			break;
//		case 0x1a:
//			ret = 0xff;
//			break;
//		case 0x1b:
// FIXME: more vice to detangle
//			ffix = (sound_sample_position() * this.v[2].fs) & 0xFFFF;
//			rvstore = this.v[2].rv;
//			if ( this.v[2].noise && this.v[2].f + ffix < this.v[2].f) {
//				this.v[2].rv = this.NSHIFT(this.v[2].rv, 16);
//			}
//			this.v[2].f += ffix;
//			ret = (this.do_osc(this.v[2]) >> 7) & 0xFF;
//			this.v[2].f -= ffix;
//			this.v[2].rv = rvstore;
//			break;
//		case 0x1c:
//			ret = (this.v[2].adsr >> 23) & 0xFF;
//			break;
//		default:
//			// FIXME: more mainclk
//			while ((tmp = this.laststorebit) && (tmp = this.laststoreclk + sidreadclocks[tmp]) < maincpu_clk) {
//				this.laststoreclk = tmp;
//				this.laststore &= 0xfeff >> this.laststorebit--;
//			}
//			ret = this.laststore;
//	}
//
//	return ret;
//};

jsSID.FastSID.prototype.reset = function (cpu_clk) {
	for (var addr = 0; addr < 32; addr++) {
		this.fastsid_store(addr, 0);
	}
	//this.laststoreclk = cpu_clk;
	// FIXME: probably need to work this in 
	//this.maincpu_clk = cpu_clk;
};

//jsSID.FastSID.prototype.prevent_clk_overflow = function (sub) {
//	this.laststoreclk -= sub;
//};

jsSID.FastSID.prototype.do_filter = function (pVoice) {

	if (!pVoice.filter) {
		return;
	}

	if (this.filter_type > 0) {
		var tmp;
		var sample, sample2;
		if (this.filter_type == 0x20) {
			pVoice.filtLow += (pVoice.filtRef * this.filterDy);
			pVoice.filtRef += (pVoice.filtIO - pVoice.filtLow - (pVoice.filtRef * this.filterResDy)) * this.filterDy;
			pVoice.filtIO = Math.floor(pVoice.filtRef - pVoice.filtLow / 4);
		} else if (this.filter_type == 0x40) {
			pVoice.filtLow += (pVoice.filtRef * this.filterDy) * 0.1;
			pVoice.filtRef += (pVoice.filtIO - pVoice.filtLow - (pVoice.filtRef * this.filterResDy)) * this.filterDy;
			sample = pVoice.filtRef - (pVoice.filtIO / 8);
			if (sample < -128) {
				sample = -128;
			}
			if (sample > 127) {
				sample = 127;
			}
			pVoice.filtIO = Math.floor(sample);
		} else {
			pVoice.filtLow += (pVoice.filtRef * this.filterDy);
			sample = pVoice.filtIO;
			sample2 = sample - pVoice.filtLow;
			tmp = Math.floor(sample2);
			sample2 -= (pVoice.filtRef * this.filterResDy);
			pVoice.filtRef += (sample2 * this.filterDy);

			// switched to case vs. chain of tertiary ops.
			// lots of things in need of casting to signed char methinks...?
			switch(this.filter_type) {
				case 0x10:
					pVoice.filtIO = Math.floor(pVoice.filtLow);
					break;
				case 0x30:
					pVoice.filtIO = Math.floor(pVoice.filtLow);
					break;
				case 0x50:
// there may be fixes needed re subtraction rollover
					//pVoice.filtIO = (Math.floor(sample) - (tmp >> 1)) & 0xff;
					pVoice.filtIO = (Math.floor(sample) - (tmp >> 1));
					break;
				case 0x60:
					pVoice.filtIO = tmp;
					break;
				case 0x70:
					//pVoice.filtIO = (Math.floor(sample) - (tmp >> 1)) & 0xff;
					pVoice.filtIO = (Math.floor(sample) - (tmp >> 1));
					break;
				default:
					pVoice.filtIO = 0;
					break;
			}
		}
	} else {
		pVoice.filtIO = 0;
	}


};

jsSID.FastSID.prototype.do_osc = function (pv) {
    if (pv.noise) {
        return (this.NVALUE(this.NSHIFT(pv.rv, pv.f >>> 28))) << 7;
    }
    var wtix = (((pv.f + pv.wtpf) & 0xFFFFFFFF) >>> pv.wtl) + pv.wt_off;
//console.log(wtix);
    return pv.wt[wtix] ^ pv.wtr[pv.vprev.f >>> 31];
};

jsSID.FastSID.prototype.calculate_single_sample = function () {
	var o0, o1, o2;
	var dosync1, dosync2;
	var v0, v1, v2;

	this.setup_sid();
	v0 = this.v[0];
	this.setup_voice(v0);
	v1 = this.v[1];
	this.setup_voice(v1);
	v2 = this.v[2];
	this.setup_voice(v2);
	dosync1 = 0;
	v0.f = ((v0.f + v0.fs) & 0xffffffff) >>> 0;
	if (v0.f < v0.fs) {
		v0.rv = this.NSHIFT(v0.rv, 16);
		if (v1.sync) {
			dosync1 = 1;
		}
	}
	dosync2 = 0;
	v1.f = ((v1.f + v1.fs) & 0xffffffff) >>> 0;
	if (v1.f < v1.fs) {
		v1.rv = this.NSHIFT(v1.rv, 16);
		if (v2.sync) {
			dosync2 = 1;
		}
	}
	v2.f = ((v2.f + v2.fs) & 0xffffffff) >>> 0;
	if (v2.f < v2.fs) {
		v2.rv = this.NSHIFT(v2.rv, 16);
		if (v0.sync) {
			v0.rv = this.NSHIFT(v0.rv, v0.f >>> 28);
			v0.f = 0;
		}
	}
	if (dosync2) {
		v2.rv = this.NSHIFT(v2.rv, v2.f >>> 28);
		v2.f = 0;
	}
	if (dosync1) {
		v1.rv = this.NSHIFT(v1.rv, v1.f >>> 28);
		v1.f = 0;
	}
	// FIXME: all this is quite ugly... 
	v0.adsr = ((v0.adsr + v0.adsrs) & 0xFFFFFFFF) >>> 0;
	if (((v0.adsr + 0x80000000) & 0xffffffff) >>> 0 < ((v0.adsrz + 0x80000000) & 0xffffffff) >>> 0) {
		this.trigger_adsr(v0);
	}
	v1.adsr = ((v1.adsr + v1.adsrs) & 0xFFFFFFFF) >>> 0;
	if (((v1.adsr + 0x80000000) & 0xffffffff) >>> 0 < ((v1.adsrz + 0x80000000) & 0xffffffff) >>> 0) {
		this.trigger_adsr(v1);
	}
	v2.adsr = ((v2.adsr + v2.adsrs) & 0xFFFFFFFF) >>> 0;
	if (((v2.adsr + 0x80000000) & 0xffffffff) >>> 0 < ((v2.adsrz + 0x80000000) & 0xffffffff) >>> 0) {
		this.trigger_adsr(v2);
	}
	o0 = v0.adsr >>> 16;
	o1 = v1.adsr >>> 16;
	o2 = v2.adsr >>> 16;
	if (o0) {
		o0 *= this.do_osc(v0);
	}
	if (o1) {
		o1 *= this.do_osc(v1);
	}
	if (this.has3 && o2) {
		o2 *= this.do_osc(v2);
	} else {
		o2 = 0;
	}
	if (this.emulate_filter) {
		v0.filtIO = this.ampMod1x8[(o0 >>> 22)];
		this.do_filter(v0);
		o0 = (v0.filtIO + 0x80) << 22;

		v1.filtIO = this.ampMod1x8[(o1 >>> 22)];
		this.do_filter(v1);
		o1 = (v1.filtIO + 0x80) << 22;

		v2.filtIO = this.ampMod1x8[(o2 >>> 22)];
		this.do_filter(v2);
		o2 = (v2.filtIO + 0x80) << 22;
	}
	var final_sample = (((o0 + o1 + o2) >>> 20) - 0x600) * this.vol;
	//if(final_sample & 0x8000) {
	//	final_sample = 0 - ((~final_sample & 0xffff) + 1);
	//}
	return (final_sample);
};

jsSID.FastSID.prototype.calculate_samples = function (pbuf, nr, interleave, delta_t, offset) {
    var i;
    for (i = 0; i < nr ; i++) {
	var idx = i * interleave + offset;
        pbuf[idx] = this.calculate_single_sample() / 32768;
    }
    return nr;
};


jsSID.FastSID.prototype.NSHIFT = function(v, n) {
		//((v << n) | (((v >> (23 - n)) ^ (v >> (18 - n))) & ((1 << n) - 1))) >>> 0
	return (
		(v << n) | (((v >>> (23 - n)) ^ (v >>> (18 - n))) & ((1 << n) - 1))
	);
};

jsSID.FastSID.prototype.NVALUE = function(v) {
	return (
		(this.noiseLSB[v & 0xff] | this.noiseMID[(v >>> 8) & 0xff] | this.noiseMSB[(v >>> 16) & 0xff])
	);

};


jsSID.FastSID.prototype.generateIntoBuffer = function(count, buffer, offset) {
        //console.log("SID.generateIntoBuffer (count: " + count + ", offset: " + offset + ")");
        // FIXME: this could be done in one pass. (No?)
        for (var i = offset; i < offset + count; i++) {
                buffer[i] = 0;
        }
        var delta = (this.cycles_per_sample * count) >> 16;
        var s = this.calculate_samples(buffer, count, 1, delta, offset);
        //console.log("SID.generateIntoBuffer (delta: " + delta + ", samples clocked: " + s + ")");
	//console.log(buffer);
        return s;
};

jsSID.FastSID.prototype.generate = function(samples) {
        var data = new Array(samples);
        this.generateIntoBuffer(samples, data, 0);
        return data;
};

// add driver profile(s) to registry:
jsSID.synth.fastsid = {
        desc: "FastSID",
        class: "FastSID",
        opts: {}
}

