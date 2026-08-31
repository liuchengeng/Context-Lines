import {
  AudioRingBuffer,
  arrayBufferToBase64,
  encodeMonoWav,
  resampleLinear,
} from "../../lib/audio-ring-buffer";

type StartMessage = { type: "audio:start"; streamId: string; tabId: number };
type StopMessage = { type: "audio:stop" };
type ClipMessage = { type: "audio:get-clip" };

let stream: MediaStream | null = null;
let context: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let ring: AudioRingBuffer | null = null;
let activeTabId: number | null = null;

async function stopCapture(notify = false): Promise<void> {
  const tabId = activeTabId;
  activeTabId = null;
  processor?.disconnect();
  processor = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  ring?.clear();
  ring = null;
  if (context) await context.close().catch(() => undefined);
  context = null;
  if (notify && tabId !== null) {
    await chrome.runtime
      .sendMessage({ type: "audio:ended", tabId })
      .catch(() => undefined);
  }
}

async function startCapture(message: StartMessage): Promise<void> {
  await stopCapture();
  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: message.streamId,
      },
    } as MediaTrackConstraints,
    video: false,
  });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(media);
  const audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  const audioRing = new AudioRingBuffer(audioContext.sampleRate, 12);

  source.connect(audioContext.destination);
  source.connect(audioProcessor);
  audioProcessor.connect(silentGain);
  silentGain.connect(audioContext.destination);
  audioProcessor.onaudioprocess = (event) => {
    audioRing.write(event.inputBuffer.getChannelData(0));
  };
  media
    .getAudioTracks()[0]
    ?.addEventListener("ended", () => void stopCapture(true));

  stream = media;
  context = audioContext;
  processor = audioProcessor;
  ring = audioRing;
  activeTabId = message.tabId;
}

chrome.runtime.onMessage.addListener(
  (
    message: StartMessage | StopMessage | ClipMessage,
    _sender,
    sendResponse,
  ) => {
    if (message.type === "audio:start") {
      void startCapture(message).then(
        () => sendResponse({ ok: true }),
        (error: unknown) =>
          sendResponse({
            ok: false,
            message:
              error instanceof Error ? error.message : "无法读取标签页声音",
          }),
      );
      return true;
    }
    if (message.type === "audio:stop") {
      void stopCapture().then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === "audio:get-clip") {
      if (!ring || !context) {
        sendResponse({ ok: false, message: "尚未开始监听" });
        return;
      }
      const source = ring.snapshot(10);
      if (source.length < context.sampleRate / 2) {
        sendResponse({ ok: false, message: "声音还太短，请播放片刻后再问" });
        return;
      }
      const samples = resampleLinear(source, context.sampleRate, 16_000);
      sendResponse({
        ok: true,
        audioBase64: arrayBufferToBase64(encodeMonoWav(samples, 16_000)),
        durationMs: Math.round((samples.length / 16_000) * 1000),
      });
      return;
    }
  },
);
