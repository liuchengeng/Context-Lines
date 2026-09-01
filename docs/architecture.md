# Architecture

## Capture

Clicking the toolbar button starts tab capture. The background service worker obtains a media stream ID, and an offscreen document consumes the stream while reconnecting it to the tab output. Mono PCM audio is kept in a fixed 12-second ring buffer.

## Configuration

The extension stores the Worker URL and relay token in `chrome.storage.local`. Doubao and DeepSeek credentials remain in Cloudflare Worker Secrets. Saved vocabulary is stored in the D1 database bound as `VOCAB_DB`.

## Quick ask flow

1. `Alt+Q` pauses the largest visible video and records its playback time.
2. The extension reads the latest ten seconds from the ring buffer, trims leading and trailing silence, limits the clip to about eight seconds, and produces a 16 kHz mono WAV.
3. The extension opens an authenticated WebSocket to `/v1/doubao` on the user's Worker.
4. The Worker adds the Doubao credentials and proxies the binary ASR protocol.
5. The English transcript is shown as soon as Doubao returns it.
6. The transcript is posted to `/v1/explain`. The Worker calls DeepSeek and validates the JSON response before returning the translation and up to three terms.

Audio and transcript results are cached in extension memory for two minutes, up to 12 entries. The cache is cleared when capture stops or the page is left.

## Vocabulary

Saving a term sends its English text, Chinese meaning, and type to `/v1/vocabulary`. D1 normalizes terms for case-insensitive deduplication. Saving an existing term updates its meaning. The vocabulary page lists and deletes items through the same authenticated Worker.

Audio, transcripts, page titles, URLs, and browsing history are not written to persistent storage.
