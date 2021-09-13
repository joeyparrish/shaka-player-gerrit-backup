/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

goog.provide('shaka.offline.AssignStreamInfo');

goog.requireType('shaka.media.InitSegmentReference');
goog.requireType('shaka.media.SegmentReference');


/**
 * TODO: description
 * @export
 */
shaka.offline.AssignStreamInfo = class {
  /**
   * @param {shaka.media.SegmentReference|shaka.media.InitSegmentReference} ref
   * @param {!shaka.extern.SegmentDataDB} data
   */
  constructor(ref, data) {
    /** @type {shaka.media.SegmentReference|shaka.media.InitSegmentReference} */
    this.ref = ref;

    /** @type {!shaka.extern.SegmentDataDB} */
    this.data = data;
  }
};
