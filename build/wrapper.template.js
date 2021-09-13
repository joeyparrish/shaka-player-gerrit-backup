/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

(function() {
  var innerGlobal;
  if (typeof window != 'undefined') {
    // This is the default state, seen in browsers.
    innerGlobal = window;
  } else if (typeof global != 'undefined') {
    // This is what is used in nodejs.
    // See https://github.com/google/shaka-player/issues/1445
    innerGlobal = global;
  } else if (typeof self != 'undefined') {
    // This is for when the player is loaded in a service worker.
    innerGlobal = self;
  }

  // This is where our library exports things to.  It is "this" in the wrapped
  // code.  With this, we can decide later what module loader we are in, if any,
  // and put these exports in the appropriate place for that loader.
  var exportTo = {};

  // According to the Closure team, their polyfills will be written to
  // $jscomp.global, which will be "window", or "global", or "this", depending
  // on circumstances.
  // See https://github.com/google/closure-compiler/issues/2957 and
  // https://github.com/google/shaka-player/issues/1455#issuecomment-393250035

  // We provide "global" for use by Closure, and "window" for use by the Shaka
  // library itself.  Both point to "innerGlobal" above.
  // We also provide "module", which is always undefined, to prevent compiled-in
  // code from doing its own exports that conflict with ours.
  (function(window, global, module) {

%output%

  }).call(/* this= */ exportTo,
          /* window= */ innerGlobal,
          /* global= */ innerGlobal,
          /* module= */ undefined);

  if (typeof exports != 'undefined') {
    // CommonJS module loader.  Use "exports" instead of "module.exports" to
    // avoid triggering inappropriately in Electron.
    for (var k in exportTo.shaka) {
      exports[k] = exportTo.shaka[k];
    }
  } else if (typeof define == 'function' && define.amd) {
    // AMD module loader.
    define(function(){
      return exportTo.shaka;
    });
  } else {
    // Loaded as an ES module or directly in a <script> tag.
    // Export directly to the global scope.
    innerGlobal.shaka = exportTo.shaka;
  }
})();
