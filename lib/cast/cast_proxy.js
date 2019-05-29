/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.provide('shaka.cast.CastProxy');

goog.require('goog.asserts');
goog.require('shaka.Deprecate');
goog.require('shaka.cast.CastSender');
goog.require('shaka.cast.CastUtils');
goog.require('shaka.log');
goog.require('shaka.util.Error');
goog.require('shaka.util.EventManager');
goog.require('shaka.util.FakeEvent');
goog.require('shaka.util.FakeEventTarget');
goog.require('shaka.util.IDestroyable');


/**
 * @event shaka.cast.CastProxy.CastStatusChangedEvent
 * @description Fired when cast status changes.  The status change will be
 *   reflected in canCast() and isCasting().
 * @property {string} type
 *   'caststatuschanged'
 * @exportDoc
 */


/**
 * @summary A proxy to switch between local and remote playback for Chromecast
 * in a way that is transparent to the app's controls.
 *
 * @implements {shaka.util.IDestroyable}
 * @export
 */
shaka.cast.CastProxy = class extends shaka.util.FakeEventTarget {
  /**
   * @param {!HTMLMediaElement} video The local video element associated with
   *   the local Player instance.
   * @param {!shaka.Player} player A local Player instance.
   * @param {string} receiverAppId The ID of the cast receiver application.
   *   If blank, casting will not be available, but the proxy will still
   *   function otherwise.
   */
  constructor(video, player, receiverAppId) {
    super();

    /** @private {HTMLMediaElement} */
    this.localVideo_ = video;

    /** @private {shaka.Player} */
    this.localPlayer_ = player;

    /** @private {Object} */
    this.videoProxy_ = null;

    /** @private {Object} */
    this.playerProxy_ = null;

    /** @private {shaka.util.FakeEventTarget} */
    this.videoEventTarget_ = null;

    /** @private {shaka.util.FakeEventTarget} */
    this.playerEventTarget_ = null;

    /** @private {shaka.util.EventManager} */
    this.eventManager_ = null;

    /** @private {shaka.cast.CastSender} */
    this.sender_ = new shaka.cast.CastSender(
        receiverAppId,
        this.onCastStatusChanged_.bind(this),
        this.onFirstCastStateUpdate_.bind(this),
        this.onRemoteEvent_.bind(this),
        this.onResumeLocal_.bind(this),
        this.getInitState_.bind(this));

    this.init_();
  }

  /**
   * Destroys the proxy and the underlying local Player.
   *
   * @param {boolean=} forceDisconnect If true, force the receiver app to shut
   *   down by disconnecting.  Does nothing if not connected.
   * @override
   * @export
   */
  destroy(forceDisconnect) {
    if (forceDisconnect && this.sender_) {
      this.sender_.forceDisconnect();
    }

    if (this.eventManager_) {
      this.eventManager_.release();
      this.eventManager_ = null;
    }

    const waitFor = [];
    if (this.localPlayer_) {
      waitFor.push(this.localPlayer_.destroy());
      this.localPlayer_ = null;
    }

    if (this.sender_) {
      waitFor.push(this.sender_.destroy());
      this.sender_ = null;
    }

    this.localVideo_ = null;
    this.videoProxy_ = null;
    this.playerProxy_ = null;

    return Promise.all(waitFor);
  }

  /**
   * Get a proxy for the video element that delegates to local and remote video
   * elements as appropriate.
   *
   * @suppress {invalidCasts} to cast proxy Objects to unrelated types
   * @return {!HTMLMediaElement}
   * @export
   */
  getVideo() {
    return /** @type {!HTMLMediaElement} */(this.videoProxy_);
  }

  /**
   * Get a proxy for the Player that delegates to local and remote Player
   * objects as appropriate.
   *
   * @suppress {invalidCasts} to cast proxy Objects to unrelated types
   * @return {!shaka.Player}
   * @export
   */
  getPlayer() {
    return /** @type {!shaka.Player} */(this.playerProxy_);
  }

  /**
   * @return {boolean} True if the cast API is available and there are
   *   receivers.
   * @export
   */
  canCast() {
    return this.sender_ ?
        this.sender_.apiReady() && this.sender_.hasReceivers() :
        false;
  }

  /**
   * @return {boolean} True if we are currently casting.
   * @export
   */
  isCasting() {
    return this.sender_ ? this.sender_.isCasting() : false;
  }

  /**
   * @return {string} The name of the Cast receiver device, if isCasting().
   * @export
   */
  receiverName() {
    return this.sender_ ? this.sender_.receiverName() : '';
  }

  /**
   * @return {!Promise} Resolved when connected to a receiver.  Rejected if the
   *   connection fails or is canceled by the user.
   * @export
   */
  cast() {
    const initState = this.getInitState_();

    // TODO: transfer manually-selected tracks?
    // TODO: transfer side-loaded text tracks?

    return this.sender_.cast(initState).then(() => {
      if (!this.localPlayer_) {
        // We've already been destroyed.
        return null;
      }

      // Unload the local manifest when casting succeeds.
      return this.localPlayer_.unload();
    });
  }

  /**
   * Set application-specific data.
   *
   * @param {Object} appData Application-specific data to relay to the receiver.
   * @export
   */
  setAppData(appData) {
    this.sender_.setAppData(appData);
  }

  /**
   * Show a dialog where user can choose to disconnect from the cast connection.
   * @export
   */
  suggestDisconnect() {
    this.sender_.showDisconnectDialog();
  }

  /**
   * Force the receiver app to shut down by disconnecting.
   * @export
   */
  forceDisconnect() {
    this.sender_.forceDisconnect();
  }

  /**
   * Initialize the Proxies and the Cast sender.
   * @private
   */
  init_() {
    this.sender_.init();

    this.eventManager_ = new shaka.util.EventManager();

    shaka.cast.CastUtils.VideoEvents.forEach((name) => {
      this.eventManager_.listen(this.localVideo_, name,
          this.videoProxyLocalEvent_.bind(this));
    });

    shaka.cast.CastUtils.PlayerEvents.forEach((name) => {
      this.eventManager_.listen(this.localPlayer_, name,
          this.playerProxyLocalEvent_.bind(this));
    });

    // We would like to use Proxy here, but it is not supported on IE11 or
    // Safari.
    this.videoProxy_ = {};
    for (const k in this.localVideo_) {
      Object.defineProperty(this.videoProxy_, k, {
        configurable: false,
        enumerable: true,
        get: this.videoProxyGet_.bind(this, k),
        set: this.videoProxySet_.bind(this, k),
      });
    }

    this.playerProxy_ = {};
    this.iterateOverPlayerMethods_((name, method) => {
      goog.asserts.assert(this.playerProxy_, 'Must have player proxy!');
      Object.defineProperty(this.playerProxy_, name, {
        configurable: false,
        enumerable: true,
        get: this.playerProxyGet_.bind(this, name),
      });
    });

    this.videoEventTarget_ = new shaka.util.FakeEventTarget();
    this.videoEventTarget_.dispatchTarget =
      /** @type {EventTarget} */(this.videoProxy_);

    this.playerEventTarget_ = new shaka.util.FakeEventTarget();
    this.playerEventTarget_.dispatchTarget =
      /** @type {EventTarget} */(this.playerProxy_);
  }

  /**
   * Iterates over all of the methods of the player, including inherited methods
   * from FakeEventTarget.
   * @param {function(string, function())} operation
   * @private
   */
  iterateOverPlayerMethods_(operation) {
    goog.asserts.assert(this.localPlayer_, 'Must have player!');
    const player = /** @type {!Object} */ (this.localPlayer_);
    // Avoid accessing any over-written methods in the prototype chain.
    const seenNames = new Set();

    // First, look at the methods on the object itself, so this can properly
    // proxy any methods not on the prototype (for example, in the mock player).
    for (const key in player) {
      if (!seenNames.has(key)) {
        seenNames.add(key);
        operation(key, player[key]);
      }
    }

    // The exact length of the prototype chain might vary; for resiliency, this
    // will just look at the entire chain, rather than assuming a set length.
    let proto = /** @type {!Object} */ (Object.getPrototypeOf(player));
    const objProto = /** @type {!Object} */ (Object.getPrototypeOf({}));
    while (proto && proto != objProto) { // Don't proxy Object methods.
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name.endsWith('_')) {
          // Don't proxy private methods.
          continue;
        }
        if (name == 'constructor') {
          // Don't proxy the constructor.
          continue;
        }
        const method = /** @type {Object} */(player)[name];
        if (typeof method != 'function') {
          // Don't proxy non-methods.
          continue;
        }
        if (!seenNames.has(name)) {
          seenNames.add(name);
          operation(name, method);
        }
      }
      proto = /** @type {!Object} */ (Object.getPrototypeOf(proto));
    }
  }

  /**
   * @return {shaka.cast.CastUtils.InitStateType} initState Video and player
   *   state to be sent to the receiver.
   * @private
   */
  getInitState_() {
    const initState = {
      'video': {},
      'player': {},
      'playerAfterLoad': {},
      'manifest': this.localPlayer_.getAssetUri(),
      'startTime': null,
    };

    // Pause local playback before capturing state.
    this.localVideo_.pause();

    shaka.cast.CastUtils.VideoInitStateAttributes.forEach((name) => {
      initState['video'][name] = this.localVideo_[name];
    });

    // If the video is still playing, set the startTime.
    // Has no effect if nothing is loaded.
    if (!this.localVideo_.ended) {
      initState['startTime'] = this.localVideo_.currentTime;
    }

    shaka.cast.CastUtils.PlayerInitState.forEach((pair) => {
      const getter = pair[0];
      const setter = pair[1];
      const value = /** @type {Object} */(this.localPlayer_)[getter]();

      initState['player'][setter] = value;
    });

    shaka.cast.CastUtils.PlayerInitAfterLoadState.forEach((pair) => {
      const getter = pair[0];
      const setter = pair[1];
      const value = /** @type {Object} */(this.localPlayer_)[getter]();

      initState['playerAfterLoad'][setter] = value;
    });

    return initState;
  }

  /**
   * Dispatch an event to notify the app that the status has changed.
   * @private
   */
  onCastStatusChanged_() {
    const event = new shaka.util.FakeEvent('caststatuschanged');
    this.dispatchEvent(event);
  }

  /**
   * Dispatch a synthetic play or pause event to ensure that the app correctly
   * knows that the player is playing, if joining an existing receiver.
   * @private
   */
  onFirstCastStateUpdate_() {
    const type = this.videoProxy_.paused ? 'pause' : 'play';
    const fakeEvent = new shaka.util.FakeEvent(type);
    this.videoEventTarget_.dispatchEvent(fakeEvent);
  }

  /**
   * Transfer remote state back and resume local playback.
   * @private
   */
  onResumeLocal_() {
    // Transfer back the player state.
    shaka.cast.CastUtils.PlayerInitState.forEach((pair) => {
      const getter = pair[0];
      const setter = pair[1];
      const value = this.sender_.get('player', getter)();
      /** @type {Object} */(this.localPlayer_)[setter](value);
    });

    // Get the most recent manifest URI and ended state.
    const assetUri = this.sender_.get('player', 'getAssetUri')();
    const ended = this.sender_.get('video', 'ended');

    let manifestReady = Promise.resolve();
    const autoplay = this.localVideo_.autoplay;

    let startTime = null;

    // If the video is still playing, set the startTime.
    // Has no effect if nothing is loaded.
    if (!ended) {
      startTime = this.sender_.get('video', 'currentTime');
    }

    // Now load the manifest, if present.
    if (assetUri) {
      // Don't autoplay the content until we finish setting up initial state.
      this.localVideo_.autoplay = false;
      manifestReady = this.localPlayer_.load(assetUri, startTime);
    }

    // Get the video state into a temp variable since we will apply it async.
    const videoState = {};
    shaka.cast.CastUtils.VideoInitStateAttributes.forEach((name) => {
      videoState[name] = this.sender_.get('video', name);
    });

    // Finally, take on video state and player's "after load" state.
    manifestReady.then(() => {
      if (!this.localVideo_) {
        // We've already been destroyed.
        return;
      }

      shaka.cast.CastUtils.VideoInitStateAttributes.forEach((name) => {
        this.localVideo_[name] = videoState[name];
      });

      shaka.cast.CastUtils.PlayerInitAfterLoadState.forEach((pair) => {
        const getter = pair[0];
        const setter = pair[1];
        const value = this.sender_.get('player', getter)();
        /** @type {Object} */(this.localPlayer_)[setter](value);
      });

      // Restore the original autoplay setting.
      this.localVideo_.autoplay = autoplay;
      if (assetUri) {
        // Resume playback with transferred state.
        this.localVideo_.play();
      }
    }, (error) => {
      // Pass any errors through to the app.
      goog.asserts.assert(error instanceof shaka.util.Error,
          'Wrong error type!');
      const event = new shaka.util.FakeEvent('error', {'detail': error});
      this.localPlayer_.dispatchEvent(event);
    });
  }

  /**
   * @param {string} name
   * @return {?}
   * @private
   */
  videoProxyGet_(name) {
    if (name == 'addEventListener') {
      return this.videoEventTarget_.addEventListener.bind(
          this.videoEventTarget_);
    }
    if (name == 'removeEventListener') {
      return this.videoEventTarget_.removeEventListener.bind(
          this.videoEventTarget_);
    }

    // If we are casting, but the first update has not come in yet, use local
    // values, but not local methods.
    if (this.sender_.isCasting() && !this.sender_.hasRemoteProperties()) {
      const value = this.localVideo_[name];
      if (typeof value != 'function') {
        return value;
      }
    }

    // Use local values and methods if we are not casting.
    if (!this.sender_.isCasting()) {
      let value = this.localVideo_[name];
      if (typeof value == 'function') {
        value = value.bind(this.localVideo_);
      }
      return value;
    }

    return this.sender_.get('video', name);
  }

  /**
   * @param {string} name
   * @param {?} value
   * @private
   */
  videoProxySet_(name, value) {
    if (!this.sender_.isCasting()) {
      this.localVideo_[name] = value;
      return;
    }

    this.sender_.set('video', name, value);
  }

  /**
   * @param {!Event} event
   * @private
   */
  videoProxyLocalEvent_(event) {
    if (this.sender_.isCasting()) {
      // Ignore any unexpected local events while casting.  Events can still be
      // fired by the local video and Player when we unload() after the Cast
      // connection is complete.
      return;
    }

    // Convert this real Event into a FakeEvent for dispatch from our
    // FakeEventListener.
    const fakeEvent = new shaka.util.FakeEvent(event.type, event);
    this.videoEventTarget_.dispatchEvent(fakeEvent);
  }

  /**
   * @param {string} name
   * @return {?}
   * @private
   */
  playerProxyGet_(name) {
    if (name == 'addEventListener') {
      return this.playerEventTarget_.addEventListener.bind(
          this.playerEventTarget_);
    }
    if (name == 'removeEventListener') {
      return this.playerEventTarget_.removeEventListener.bind(
          this.playerEventTarget_);
    }

    if (name == 'getMediaElement') {
      return () => this.videoProxy_;
    }

    if (name == 'getSharedConfiguration') {
      shaka.log.warning(
          'Can\'t share configuration across a network. Returning copy.');
      return this.sender_.get('player', 'getConfiguration');
    }

    if (name == 'getNetworkingEngine') {
      // Always returns a local instance, in case you need to make a request.
      // Issues a warning, in case you think you are making a remote request
      // or affecting remote filters.
      if (this.sender_.isCasting()) {
        shaka.log.warning('NOTE: getNetworkingEngine() is always local!');
      }
      return this.localPlayer_.getNetworkingEngine.bind(this.localPlayer_);
    }

    if (this.sender_.isCasting()) {
      // These methods are unavailable or otherwise stubbed during casting.
      if (name == 'getManifest' || name == 'drmInfo') {
        return function() {
          shaka.log.alwaysWarn(name + '() does not work while casting!');
          return null;
        };
      }

      if (name == 'getManifestUri') {
        shaka.Deprecate.deprecateFeature(
            2, 6,
            'getManifestUri',
            'Please use "getAssetUri" instead.');

        return this.playerProxyGet_('getAssetUri');
      }

      if (name == 'attach' || name == 'detach') {
        return function() {
          shaka.log.alwaysWarn(name + '() does not work while casting!');
          return Promise.resolve();
        };
      }
    }  // if (this.sender_.isCasting())

    // If we are casting, but the first update has not come in yet, use local
    // getters, but not local methods.
    if (this.sender_.isCasting() && !this.sender_.hasRemoteProperties()) {
      if (shaka.cast.CastUtils.PlayerGetterMethods[name]) {
        const value = /** @type {Object} */(this.localPlayer_)[name];
        goog.asserts.assert(typeof value == 'function',
            'only methods on Player');
        return value.bind(this.localPlayer_);
      }
    }

    // Use local getters and methods if we are not casting.
    if (!this.sender_.isCasting()) {
      const value = /** @type {Object} */(this.localPlayer_)[name];
      goog.asserts.assert(typeof value == 'function',
          'only methods on Player');
      return value.bind(this.localPlayer_);
    }

    return this.sender_.get('player', name);
  }

  /**
   * @param {!Event} event
   * @private
   */
  playerProxyLocalEvent_(event) {
    if (this.sender_.isCasting()) {
      // Ignore any unexpected local events while casting.
      return;
    }

    this.playerEventTarget_.dispatchEvent(event);
  }

  /**
   * @param {string} targetName
   * @param {!shaka.util.FakeEvent} event
   * @private
   */
  onRemoteEvent_(targetName, event) {
    goog.asserts.assert(this.sender_.isCasting(),
        'Should only receive remote events while casting');
    if (!this.sender_.isCasting()) {
      // Ignore any unexpected remote events.
      return;
    }

    if (targetName == 'video') {
      this.videoEventTarget_.dispatchEvent(event);
    } else if (targetName == 'player') {
      this.playerEventTarget_.dispatchEvent(event);
    }
  }
};
