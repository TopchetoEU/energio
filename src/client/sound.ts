const audioCtx = new AudioContext();

export class sound {
    private _source: AudioBufferSourceNode;

    public play() {
        this._source.start();
    }
    public stop() {
        this._source.stop();
    }
    public free() {
        this._source.disconnect();
    }

    public constructor(audio: AudioBuffer) {
        audioCtx.resume();
        this._source = audioCtx.createBufferSource();
        this._source.buffer = audio;
        this._source.connect(audioCtx.destination);
    }

    public static async fromURL(src: string): Promise<sound> {
        let fetched = await fetch(src);
        let buff = await fetched.arrayBuffer();
        let audio = await audioCtx.decodeAudioData(buff);

        return new sound(audio);
    }
}
