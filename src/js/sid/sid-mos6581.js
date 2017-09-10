
var sid = sid || {};

/*
The following is ripped from jssid.core.js and shouldn't be uncommented here.
It is used purely for informational purposes.

jsSID.quality = Object.freeze({
        low: "tinysid",
        medium: "fastsid",
        good: "resid_fast",
        better: "resid_interpolate",
        best: "resid_resample_interpolate",
        broken: "resid_resample_fast"
});
*/

sid.init = function() {
    //sidPlayer = new jsSID.SIDPlayer({ quality: getQuality(), clock: getFreq(), model: getModel() });
    //sidPlayer = new jsSID.SIDPlayer({quality: jsSID.quality.good, clock: jsSID.chip.clock.PAL, model: jsSID.chip.model.MOS6581});
    //sidPlayer = new jsSID.SIDPlayer();
    sidPlayer = new jsSID.SIDPlayer({quality: jsSID.quality.low});
    sidPlayer.play();
}

sid.play = function () {
    sidPlayer.play();
}

sid.stop = function () {
    sidPlayer.stop();
}

// constructor
jsSID.SIDPlayer = function(opts) {
    opts = opts || {};
    this.quality = opts.quality || jsSID.quality.good;
    this.clock = opts.clock || jsSID.chip.clock.PAL;
    this.model = opts.model || jsSID.chip.model.MOS6581;

	this.play_active = true;
	this.samplesToNextFrame = 0;
	// state signaled to audio manager
	this.ready = false;
	this.finished = false;

    var that = this;
    this.synth = jsSID.synthFactory({
            quality: this.quality,
            clock: this.clock,
            model: this.model,
            sampleRate: pico.samplerate
    });

}

// Pico.js hook for processing
jsSID.SIDPlayer.prototype.process = function(L, R) {
    if(this.ready) {
        var written = this.generateIntoBuffer(L.length, L, 0);
        if (written === 0) {
            //play_mod(random_mod_href());
            this.ready = false;
            this.finished = true;
            this.stop();
        } else {
            // copy left channel to right
            for (var i = 0; i < L.length; i++) {
                R[i] = L[i];
            }
        }
    } else {
        this.stop();
    }
};

jsSID.SIDPlayer.prototype.play = function() {
    this.ready = true;
	pico.play(this);
};

jsSID.SIDPlayer.prototype.stop = function() {
	pico.pause();
    this.ready = false;
};

jsSID.SIDPlayer.prototype.getNextFrame = function() {
	if (this.play_active) {
		// this.cpu.cpuJSR(this.sidfile.play_addr, 0);
		// check if CIA timing is used, and adjust

        //var nRefreshCIA = Math.floor(20000 * (cpuMemoryManager.readByte(0xdc04) | (cpuMemoryManager.readByte(0xdc05) << 8)) / 0x4c00);
        var nRefreshCIA = Math.floor(20000 * (mos6510.memory.readByte(0xdc04) | (mos6510.memory.readByte(0xdc05) << 8)) / 0x4c00);
        //if ((nRefreshCIA === 0) || (this.sidspeed === 0)) nRefreshCIA = 20000;
		this.samplesPerFrame = Math.floor(this.synth.mix_freq * nRefreshCIA / 1000000);

		this.samplesToNextFrame += this.samplesPerFrame;
	} else {
		// FIXME: currently, this is not reachable really
			
		// no frames left
		this.samplesToNextFrame = null;

		// FIXME: this should be a feature of SidSynth we call
		// zero out sid registers at end to prevent noise
		var count = 0;
		while ( count < 25) {
			this.synth.poke(count, 0);
			count++;
		}
		this.finished = true;
	}
};
	
jsSID.SIDPlayer.prototype.generate = function(samples) {
	var data = new Array(samples*2);
	this.generateIntoBuffer(samples, data, 0);
	return data;
};
	
// generator
jsSID.SIDPlayer.prototype.generateIntoBuffer = function(samples, data, dataOffset) {
	if(!this.ready) return 0;
	dataOffset = dataOffset || 0;
	var dataOffsetStart = dataOffset;

	//console.log("Generating " + samples + " samples (" + this.samplesToNextFrame + " to next frame)");
	var samplesRemaining = samples;
	var generated;	
	while (true) {
		if (this.samplesToNextFrame !== null && this.samplesToNextFrame <= samplesRemaining) {
			var samplesToGenerate = Math.ceil(this.samplesToNextFrame);
			//console.log("next frame: " + this.samplesToNextFrame + ", remaining: " + this.samplesRemaining + ", offset: " + dataOffset + ", generate: " + samplesToGenerate);
			if (samplesToGenerate > 0) {
				generated = this.synth.generateIntoBuffer(samplesToGenerate, data, dataOffset);
				dataOffset += generated;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
			this.getNextFrame();
		} else {
			/* generate samples to end of buffer */
			if (samplesRemaining > 0) {
				generated = this.synth.generateIntoBuffer(samplesRemaining, data, dataOffset);
				dataOffset += generated;
				samplesRemaining -= generated;
				this.samplesToNextFrame -= generated;
			}
			break;
		}
	}
	//console.log("data: ", data);
	return dataOffset - dataOffsetStart;
};

