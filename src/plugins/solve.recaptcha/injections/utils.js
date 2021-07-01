module.exports = () => {
  try {
    // Credit to https://github.com/dessant/buster
    window.normalizeAudio = async function (buffer) {
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(buffer);
      ctx.close();

      const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
      const source = offlineCtx.createBufferSource();
      source.connect(offlineCtx.destination);
      source.buffer = audioBuffer;
      source.start();

      return offlineCtx.startRendering();
    };

    window.sliceAudio = function ({ audioBuffer, start, end }) {
      const sampleRate = audioBuffer.sampleRate;
      const channels = audioBuffer.numberOfChannels;

      const startOffset = sampleRate * start;
      const endOffset = sampleRate * end;
      const frameCount = endOffset - startOffset;

      const ctx = new AudioContext();
      const audioSlice = ctx.createBuffer(channels, frameCount, sampleRate);
      ctx.close();

      const tempArray = new Float32Array(frameCount);
      for (var channel = 0; channel < channels; channel++) {
        audioBuffer.copyFromChannel(tempArray, channel, startOffset);
        audioSlice.copyToChannel(tempArray, channel, 0);
      }

      return audioSlice;
    };

    // Credit to https://github.com/Jam3/audiobuffer-to-wav
    window.audioBufferToWav = function (buffer, opt) {
      opt = opt || {};

      var numChannels = buffer.numberOfChannels;
      var sampleRate = buffer.sampleRate;
      var format = opt.float32 ? 3 : 1;
      var bitDepth = format === 3 ? 32 : 16;

      var result;
      if (numChannels === 2) {
        result = _.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
      } else {
        result = buffer.getChannelData(0);
      }

      return _.encodeWAV(result, format, sampleRate, numChannels, bitDepth);
    };

    const _ = {
      encodeWAV: (samples, format, sampleRate, numChannels, bitDepth) => {
        var bytesPerSample = bitDepth / 8;
        var blockAlign = numChannels * bytesPerSample;

        var buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
        var view = new DataView(buffer);

        /* RIFF identifier */
        _.writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + samples.length * bytesPerSample, true);
        /* RIFF type */
        _.writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        _.writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, format, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * blockAlign, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, blockAlign, true);
        /* bits per sample */
        view.setUint16(34, bitDepth, true);
        /* data chunk identifier */
        _.writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * bytesPerSample, true);
        if (format === 1) { // Raw PCM
          _.floatTo16BitPCM(view, 44, samples);
        } else {
          _.writeFloat32(view, 44, samples);
        }

        return buffer;
      },
      interleave: (inputL, inputR) => {
        var length = inputL.length + inputR.length;
        var result = new Float32Array(length);

        var index = 0;
        var inputIndex = 0;

        while (index < length) {
          result[index++] = inputL[inputIndex];
          result[index++] = inputR[inputIndex];
          inputIndex++;
        }
        return result;
      },
      writeFloat32: (output, offset, input) => {
        for (var i = 0; i < input.length; i++, offset += 4) {
          output.setFloat32(offset, input[i], true);
        }
      },
      floatTo16BitPCM: (output, offset, input) => {
        for (var i = 0; i < input.length; i++, offset += 2) {
          var s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      },
      writeString: (view, offset, string) => {
        for (var i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }
    };
  } catch (ex) { null; }
};