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

/**
 * Sets up google analytics.
 */
class ShakaDemoAnalytics {
  /** @private */
  static setup_() {
    // Store the name of the Analytics object.
    window['GoogleAnalyticsObject'] = 'ga';

    // Create the Analytics object.
    // This function has multiple forms, but we only ever use the two-argument
    // form. So that's the only one we need to set up.
    window['ga'] = (command, fieldsObject) => {
      // Add the task to the queue.
      window['ga'].q.push([command, fieldsObject]);
    };

    // Create the queue.
    window['ga'].q = [];

    // Store the current timestamp.
    window['ga'].l = (new Date()).getTime();

    // Set up the Analytics object with our Google Analytics Id.
    window['ga']('create', {
      trackingId: 'UA-141587413-1',
      cookieDomain: 'auto',
    });
    // window['ga']((tracker) => {
    //   // TODO: I can use this to get the tracker object, but I dunno if I
    //   // need it for anything...
    //   // maybe if I ever need to GET the data in the tracker?
    //   console.log('tracker', tracker);
    // });
  }
}

// Setup analytics IMMEDIATELY.
ShakaDemoAnalytics.setup_();
