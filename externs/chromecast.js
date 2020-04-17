/** @license
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Google Cast API externs.
 * Based on the {@link https://bit.ly/CastApi Google Cast API}.
 * @externs
 */


/** @type {function(boolean)?} */
var __onGCastApiAvailable;


/** @const */
var cast = {};


/** @const */
cast.receiver = {};


/** @const */
cast.receiver.system = {};


/** @typedef {{level: number, muted: boolean}} */
cast.receiver.system.SystemVolumeData;


cast.receiver.CastMessageBus = class {
  /** @param {string} namespace */
  constructor(namespace) {
    /** @type {function({data: string, senderId: string})} */
    this.onMessage;
  }

  /** @param {*} message */
  broadcast(message) {}

  /**
   * @param {string} senderId
   * @return {!cast.receiver.CastChannel}
   */
  getCastChannel(senderId) {}
};


/**
 * @constructor
 * @struct
 */
cast.receiver.CastMessageBus.Event = class {};


/** @type {?} */
cast.receiver.CastMessageBus.Event.prototype.data;


/** @type {string} */
cast.receiver.CastMessageBus.Event.prototype.senderId;


cast.receiver.CastChannel = class {
  /** @param {!BroadcastChannel} channel */
  constructor(channel) {}

  /** @param {*} message */
  send(message) {}
};


cast.receiver.CastReceiverManager = class {
  constructor() {
    /** @type {function()} */
    this.onSenderConnected;

    /** @type {function()} */
    this.onSenderDisconnected;

    /** @type {function()} */
    this.onSystemVolumeChanged;
  }

  /** @return {cast.receiver.CastReceiverManager} */
  static getInstance() {}

  /**
   * @param {string} namespace
   * @param {string=} messageType
   * @return {cast.receiver.CastMessageBus}
   */
  getCastMessageBus(namespace, messageType) {}

  /** @return {Array.<string>} */
  getSenders() {}

  start() {}

  stop() {}

  /** @return {?cast.receiver.system.SystemVolumeData} */
  getSystemVolume() {}

  /** @param {number} level */
  setSystemVolumeLevel(level) {}

  /** @param {boolean} muted */
  setSystemVolumeMuted(muted) {}

  /** @return {boolean} */
  isSystemReady() {}
};


/** @const */
cast.__platform__ = class {
  /**
   * @param {string} type
   * @return {boolean}
   */
  static canDisplayType(type) {}
};


/** @const */
var chrome = {};


/** @const */
chrome.cast = class {
  /**
   * @param {!chrome.cast.ApiConfig} apiConfig
   * @param {function()} successCallback
   * @param {function(?)} errorCallback
   */
  static initialize(apiConfig, successCallback, errorCallback) {}

  /**
   * @param {function(!chrome.cast.Session)} successCallback
   * @param {function(?)} errorCallback
   * @param {chrome.cast.SessionRequest=} sessionRequest
   */
  static requestSession(successCallback, errorCallback, sessionRequest) {}
};


/** @type {boolean} */
chrome.cast.isAvailable;


/** @enum {string} */
chrome.cast.SessionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  STOPPED: 'stopped',
};


chrome.cast.ApiConfig = class {
  /**
   * @param {chrome.cast.SessionRequest} sessionRequest
   * @param {function(!chrome.cast.Session)} sessionListener
   * @param {function(string)} receiverListener
   * @param {string=} autoJoinPolicy
   * @param {string=} defaultActionPolicy
   */
  constructor(sessionRequest, sessionListener, receiverListener,
      autoJoinPolicy, defaultActionPolicy) {
    /** @type {function(!chrome.cast.Session)} */
    this.sessionListener;

    /** @type {function(string)} */
    this.receiverListener;
  }
};


chrome.cast.Error = class {
  /**
   * @param {string} code
   * @param {string=} description
   * @param {Object=} details
   */
  constructor(code, description, details) {
    /** @type {string} */
    this.code;

    /** @type {?string} */
    this.description;

    /** @type {Object} */
    this.details;
  }
};


/** @typedef {{friendlyName: string}} */
chrome.cast.Receiver;


chrome.cast.Session = class {
  constructor() {
    /** @type {string} */
    this.sessionId;

    /** @type {string} */
    this.status;

    /** @type {chrome.cast.Receiver} */
    this.receiver;
  }

  /**
   * @param {string} namespace
   * @param {function(string, string)} listener
   */
  addMessageListener(namespace, listener) {}

  /**
   * @param {string} namespace
   * @param {function(string, string)} listener
   */
  removeMessageListener(namespace, listener) {}

  /** @param {function()} listener */
  addUpdateListener(listener) {}

  /** @param {function()} listener */
  removeUpdateListener(listener) {}

  /**
   * @param {function()} successCallback
   * @param {function(?)} errorCallback
   */
  leave(successCallback, errorCallback) {}

  /**
   * @param {string} namespace
   * @param {!Object|string} message
   * @param {function()} successCallback
   * @param {function(?)} errorCallback
   */
  sendMessage(namespace, message, successCallback, errorCallback) {}

  /**
   * @param {function()} successCallback
   * @param {function(?)} errorCallback
   */
  stop(successCallback, errorCallback) {}
};


chrome.cast.SessionRequest = class {
  /** @param {string} appId */
  constructor(appId) {}
};
