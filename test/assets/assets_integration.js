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

describe('Assets', () => {
  const Feature = shakaAssets.Feature;
  const KeySystem = shakaAssets.KeySystem;

  it('have unique names', () => {
    const names = new Set();
    const duplicateNames = new Set();
    for (const asset of shakaAssets.testAssets) {
      if (names.has(asset.name)) {
        duplicateNames.add(asset.name);
      } else {
        names.add(asset.name);
      }
    }
    const asArray = Array.from(duplicateNames);
    expect(asArray.length).toBe(0, 'Duplicate names: ' + asArray);
  });

  describe('feature validity check', () => {
    /** @type {HTMLVideoElement} */
    let video;
    /** @type {shaka.Player} */
    let player;
    /** @type {?function(!shaka.extern.Manifest, boolean)} */
    let getManifestCallback;

    beforeAll(() => {
      video = shaka.util.Dom.createVideoElement();
      video.width = 600;
      video.height = 400;
      video.muted = true;
      document.body.appendChild(video);
    });

    afterAll(() => {
      document.body.removeChild(video);
    });

    beforeEach(() => {
      player = new shaka.Player(video);
      player.addEventListener('manifestparsed', () => {
        const manifest = player.getManifest();
        goog.asserts.assert(manifest, 'Must have a manifest.');
        const isDash =
            player.getManifestParserFactory() == shaka.dash.DashParser;
        getManifestCallback(manifest, isDash);
      });
    });

    afterEach(async () => {
      await player.destroy();
    });

    /**
     * Add in expected features based on the text streams in the player.
     * @param {!Set.<!shakaAssets.Feature>} features
     */
    function detectTextFeatures(features) {
      for (const period of player.getManifest().periods) {
        for (const stream of period.textStreams) {
          switch (stream.kind) {
            case 'caption':
              features.add(Feature.CAPTIONS);
              break;
            case 'subtitle':
              features.add(Feature.SUBTITLES);
              break;
          }
          if (stream.codecs) {
            if (stream.codecs.includes('stpp')) {
              features.add(Feature.TTML);
            }
            if (stream.codecs.includes('wvtt')) {
              features.add(Feature.WEBVTT);
            }
          } else {
            switch (stream.mimeType) {
              case 'text/vtt':
                features.add(Feature.WEBVTT);
                break;
              case 'application/ttml+xml':
                features.add(Feature.TTML);
                break;
            }
          }
        }
      }
    }

    /**
     * Add in expected features based on the manifest (and other loaded
     * metadata).
     * @param {!Set.<!shakaAssets.Feature>} features
     * @param {!Set.<!shakaAssets.KeySystem>} keySystems
     * @param {!shaka.extern.Manifest} manifest
     * @param {boolean} isDash
     */
    function detectNonTextFeatures(features, keySystems, manifest, isDash) {
      features.add(isDash ? Feature.DASH : Feature.HLS);
      if (manifest.presentationTimeline.isLive()) {
        features.add(Feature.LIVE);
      }
      if (manifest.periods.length > 1) {
        features.add(Feature.MULTIPERIOD);
      }
      if (manifest.periods[0].startTime > 0 &&
          manifest.presentationTimeline.isLive()) {
        // If the "first period" starts after time 0, it's probably multiperiod.
        features.add(Feature.MULTIPERIOD);
      }
      const languages = new Set();
      const keyIds = new Set();
      let hasVideo = false;
      for (const period of manifest.periods) {
        for (const variant of period.variants) {
          for (const drmInfo of variant.drmInfos) {
            if (drmInfo.keyIds) {
              for (const keyId of drmInfo.keyIds) {
                keyIds.add(keyId);
              }
            }
          }
          if (variant.video) {
            hasVideo = true;
          }
          for (const drmInfo of variant.drmInfos) {
            const keySystem =
            /** @type {!shakaAssets.KeySystem} */ (drmInfo.keySystem);
            keySystems.add(keySystem);
          }
          for (const stream of [variant.audio, variant.video]) {
            if (!stream) {
              continue;
            }
            switch (stream.mimeType) {
              case 'video/webm':
              case 'audio/webm':
                features.add(Feature.WEBM);
                break;
              case 'video/mp4':
              case 'audio/mp4':
                features.add(Feature.MP4);
                break;
              case 'video/mp2t':
                features.add(Feature.MP2TS);
                break;
            }
            if (stream.language && stream.language != 'und') {
              languages.add(stream.language);
            }
            if (stream.channelsCount == 6 || stream.channelsCount == 8) {
              features.add(Feature.SURROUND);
            }
            if (stream.width >= 3840) {
              features.add(Feature.ULTRA_HIGH_DEFINITION);
            }
            if (stream.height >= 720) {
              features.add(Feature.HIGH_DEFINITION);
            }
            if (stream.trickModeVideo) {
              features.add(Feature.TRICK_MODE);
            }
            if (stream.closedCaptions && stream.closedCaptions.size) {
              features.add(Feature.EMBEDDED_TEXT);
            }
          }
        }
      }
      if (keySystems.size == 0) {
        keySystems.add(KeySystem.CLEAR);
      }
      if (!hasVideo) {
        features.add(Feature.AUDIO_ONLY);
      }
      if (languages.size > 1) {
        features.add(Feature.MULTIPLE_LANGUAGES);
      }
      if (keyIds.size > 1) {
        features.add(Feature.MULTIKEY);
      }
    }

    for (const asset of shakaAssets.testAssets) {
      // Don't test disabled assets.
      if (asset.disabled) {
        continue;
      }

      const name = 'for ' + asset.name;
      it(name, async () => {
        asset.applyFilters(player.getNetworkingEngine());
        const config = asset.getConfiguration();
        player.configure(config);

        /** @type {!Set.<!shakaAssets.Feature>} */
        const expectedFeatures = new Set();
        /** @type {!Set.<!shakaAssets.KeySystem>} */
        const expectedKeySystems = new Set();
        getManifestCallback = (manifest, isDash) => {
          detectNonTextFeatures(
              expectedFeatures, expectedKeySystems, manifest, isDash);
        };
        try {
          await player.load(asset.manifestUri);
          // eslint-disable-next-line no-restricted-syntax
        } catch (e) {
          // We expect to sometimes see key system unavailable errors; if we see
          // any other error, expose that.
          const Code = shaka.util.Error.Code;
          if (e.code != Code.REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE) {
            throw e;
          }
        }
        for (const extraText of (asset.extraText || [])) {
          // |player.addTextTrack| is asynchronous, but by the time it returns
          // it should have added the empty text track to the manifest.
          player.addTextTrack(extraText.uri, extraText.language,
              extraText.kind, extraText.mime,
              extraText.codecs);
        }
        detectTextFeatures(expectedFeatures);
        // TODO: Check for offline support in the future? Will probably involve
        // actually downloading.

        // These are the features we do not test for, at the moment.
        /** @type {!Set.<!shakaAssets.Feature>} */
        const featureBlacklist = new Set([
          Feature.ENCRYPTED_WITH_CLEAR,
          Feature.AESCTR_8_BYTE_IV,
          Feature.AESCTR_16_BYTE_IV,
          Feature.XLINK,
          Feature.OFFLINE,
        ]);

        // Display feature differences in a more human-readable way.
        const missingFeatures = Array.from(expectedFeatures)
            .filter((feature) => !featureBlacklist.has(feature))
            .filter((feature) => !asset.features.includes(feature));
        expect(missingFeatures.length)
            .toBe(0, 'Missing features: ' + missingFeatures.join(', '));
        if (!expectedFeatures.has(Feature.MULTIPERIOD) ||
            !expectedFeatures.has(Feature.LIVE)) {
          // Live, multi-period assets might have features that only show up
          // sometimes, but not show up other times. Don't error if there's such
          // a feature.
          const excessFeatures = asset.features
              .filter((feature) => !featureBlacklist.has(feature))
              .filter((feature) => !expectedFeatures.has(feature));
          expect(excessFeatures.length)
              .toBe(0, 'Excess features: ' + excessFeatures.join(', '));
        }
        const missingKeySystems = Array.from(expectedKeySystems)
            .filter((keySystem) => !asset.drm.includes(keySystem));
        expect(missingKeySystems.length)
            .toBe(0, 'Missing key systems: ' + missingKeySystems.join(', '));
        const excessKeySystems = asset.drm
            .filter((keySystem) => !expectedKeySystems.has(keySystem));
        expect(excessKeySystems.length)
            .toBe(0, 'Excess key systems: ' + excessKeySystems.join(', '));
      });
    }
  });
});
