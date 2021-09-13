const shakaPlayerLoaded = new Promise((resolve, reject) => {
  addEventListener('install', (event) => {
    skipWaiting();

    // TODO: should I load it from online, or locally?
    // online, I'd be worried about hammering our services too hard...
    // locally, it kind of assumes things about the user's folder structure...
    importScripts('../dist/shaka-player.compiled.js');
    console.log('Loaded Shaka Player.');
    resolve();
  });
});

addEventListener('backgroundfetchsuccess', (event) => {
  const bgFetch = event.registration;
  console.log('backgroundfetchsuccess', event, bgFetch);

  const eventHandler = async () => {
    await shakaPlayerLoaded; // Wait until Shaka Player is loaded.

    const manifestId = parseInt(bgFetch.id.split('-')[1], 10);

    const records = await bgFetch.matchAll();
    const toAssignPromises = [];
    for (const record of records) {
      toAssignPromises.push((async () => {
        const request = record.request;
        const response = await record.responseReady;

        // TODO: responseReady will fail if anything fails to fetch...
        // so clear and fail in that case!

        // TODO: WAIT FUCK I'M STUPID
        // I didn't need this fancy system for mapping refIds at all!
        // because!!!!!
        // apparently records... also store the request...
        // so I could just extract the header from that
        // fuck...
        // TODO: ok so change this to use the headers from the REQUEST, not the
        // RESPONSE
        // I can get the request with "record.request", much as I can get the
        // response with "record.responseReady"

        // Reconstruct the segment reference. We only need the URI and byte
        // range for this, so an init segment reference is simpler.
        let startByte = 0;
        let endByte = null;
        if (response.headers.has('Content-Range')) {
          // Only byte ranges are supported by BG fetch, so assume it's that.
          const range = response.headers.get('Content-Range');
          const split = range.split(' ')[1].split('-');
          startByte = parseInt(split[0], 10);
          if (split[1]) {
            // The end is expressed as "endByte/size"
            const endSplit = split[1].split('/');
            endByte = parseInt(endSplit[0], 10);
            const size = parseInt(endSplit[1], 10);
            if (endByte == size - 1) {
              // This was actually an unbounded request.
              endByte = null;
            }
          }
        }
        // The actual type of segment ref (init or normal) doesn't matter.
        // All that matters is the start byte, end byte, and uris.
        // An InitSegmentReference is easier to declare, so use one of those.
        const getUris = () => [response.url];
        const ref = new shaka.media.InitSegmentReference(
            getUris, startByte, endByte);
        // TODO: will this fail if the download is redirected? since it's the
        // URL of the response, not the request

        const arrayBuffer = await response.arrayBuffer();
        // TODO: this array buffer is empty?
        // all of the examples put the stuff into cache, is that actually a
        // necessary step?
        // if I can't figure this out, I might need to contact the fetch people
        // again
        // TODO: ok, the array buffer is byteLength=0 even here, so it's not
        // due to the array buffer being emptied mid-store...
        // TODO: also cache can't store partial responses...
        // TODO: also the BG fetch tracker diagnostic ALSO shows the downloads
        // as having size=0 bytes
        // so this might not just be a problem with the arrayBuffer method
        // after all...
        return new shaka.offline.AssignStreamInfo(ref, {data: arrayBuffer});
      })());
    }

    // Wait for all of these datas to be fetched, and packaged with appropriate
    // references, then assign them to the manifest.
    const toAssign = await Promise.all(toAssignPromises);
    const throwIfAbortedFn = () => {
      // TODO: throw if this has been canceled...
    };
    await shaka.offline.Storage.assignStreamsToManifest(
        manifestId, toAssign, throwIfAbortedFn);
  };
  event.waitUntil(eventHandler());
});

addEventListener('backgroundfetchfail', (event) => {
  const bgFetch = event.registration;
  console.log('backgroundfetchfail', event, bgFetch);
  // TODO:
  // static async cleanStoredManifest(manifestId)
});

addEventListener('backgroundfetchabort', (event) => {
  const bgFetch = event.registration;
  console.log('backgroundfetchabort', event, bgFetch);
  // TODO:
  // static async cleanStoredManifest(manifestId)
});

addEventListener('backgroundfetchclick', (event) => {
  const bgFetch = event.registration;
  console.log('backgroundfetchclick', event, bgFetch);
  // TODO: when I tried clicking on the BG fetch download, my browser crashed?
  // TODO: open the page? or something...
  // clients.openWindow('/');
});

