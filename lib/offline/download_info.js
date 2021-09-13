/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

goog.provide('shaka.offline.DownloadInfo');

goog.require('shaka.util.Networking');
goog.requireType('shaka.media.InitSegmentReference');
goog.requireType('shaka.media.SegmentReference');


/**
 * An object that represents a single segment, that the storage system will soon
 * download, but has not yet started downloading.
 */
shaka.offline.DownloadInfo = class {
  /**
   * @param {shaka.media.SegmentReference|shaka.media.InitSegmentReference} ref
   * @param {number} estimateId
   * @param {number} groupId
   * @param {boolean} isInitSegment
   */
  constructor(ref, estimateId, groupId, isInitSegment) {
    /** @type {shaka.media.SegmentReference|shaka.media.InitSegmentReference} */
    this.ref = ref;

    /** @type {number} */
    this.estimateId = estimateId;

    /** @type {number} */
    this.groupId = groupId;

    /** @type {boolean} */
    this.isInitSegment = isInitSegment;
  }

  /**
   * @param {string} refId
   * @return {{
   *   uri: string,
   *   endByte: ?number
   * }}
   * @private
   */
  static breakDownRefId_(refId) {
    const uri = refId.split('}')[0];
    const refIdSplit = refId.split(':');
    const endByteRaw = refIdSplit[refIdSplit.length - 1];
    let endByte = null;
    if (endByteRaw != 'null') {
      endByte = parseInt(endByteRaw, 10);
    }
    return {uri, endByte};
  }

  /**
   * The service worker has to determine what the original refId of a request
   * is by the headers on the response. This works in most cases, but refs
   * where there is a startByte but endByte is null (e.g. go till end of file)
   * are replaced with the actual endByte. This means that, on the service
   * worker end, there's no way of telling the difference between a reference
   * that goes to "null", or a reference that goes to the exact byte of the end
   * of the file.
   * @param {!Set.<string>} refIds
   * @return {!Map.<string, string>} changeMap
   */
  static translateRefIds(refIds) {
    /** @type {!Map.<string, (number|null)>} */
    const endBytesByUri = new Map();
    for (const refId of refIds) {
      const {uri, endByte} = shaka.offline.DownloadInfo.breakDownRefId_(refId);
      let finalEndByte = endByte;

      // Is the previous last better than this? "null" is the best.
      if (endBytesByUri.has(uri) && finalEndByte != null) {
        const oldEndByte = endBytesByUri.get(uri);
        if (oldEndByte == null) {
          finalEndByte = null;
        } else {
          finalEndByte = Math.max(finalEndByte, oldEndByte);
        }
      }
      endBytesByUri.set(uri, finalEndByte);
    }
    // TODO: this approach does have the bug that if a manifest has BOTH a ref
    // that goes to the explicit end, AND a ref that goes to the undefined end,
    // they won't be considered the same...
    const changeMap = new Map();
    for (const refId of refIds) {
      const {uri, endByte} = shaka.offline.DownloadInfo.breakDownRefId_(refId);
      let finalEndByte = endByte;
      if (finalEndByte == endBytesByUri.get(uri)) {
        finalEndByte = 'FINAL';
      }
      /** @type {!Array.<string>} */
      const refIdSplit = refId.split(':');
      refIdSplit.pop();
      refIdSplit.push(`${finalEndByte}`);
      changeMap.set(refId, refIdSplit.join(':'));
    }
    return changeMap;
  }

  /**
   * Creates an ID that encapsulates all important information in the ref, which
   * can then be used to check for equality.
   * @param {shaka.media.SegmentReference|shaka.media.InitSegmentReference} ref
   * @return {string}
   */
  static idForSegmentRef(ref) {
    // Escape the URIs using encodeURI, to make sure that a weirdly formed URI
    // cannot cause two unrelated refs to be considered equivalent.
    return ref.getUris().map((uri) => '{' + encodeURI(uri) + '}').join('') +
        ':' + ref.startByte + ':' + ref.endByte;
  }

  /** @return {string} */
  getRefId() {
    return shaka.offline.DownloadInfo.idForSegmentRef(this.ref);
  }

  /**
   * @param {shaka.extern.PlayerConfiguration} config
   * @return {!shaka.extern.Request}
   */
  makeSegmentRequest(config) {
    return shaka.util.Networking.createSegmentRequest(
        this.ref.getUris(),
        this.ref.startByte,
        this.ref.endByte,
        config.streaming.retryParameters);
  }
};
