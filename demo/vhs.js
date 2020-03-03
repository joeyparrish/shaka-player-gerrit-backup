/** @license
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

document.addEventListener('shaka-ui-loaded', () => {
  const video =
  /** @type {!HTMLVideoElement} */ (document.getElementById('video'));
  if (!video) {
    // Cannot set up outside of the demo environment.
    return;
  }
  const ui = video['ui'];
  const player = ui.getControls().getPlayer();
  const container = video.parentElement;
  const canvas =
  /** @type {!HTMLCanvasElement} */ (document.createElement('canvas'));
  if (video.nextSibling) {
    container.insertBefore(canvas, video.nextSibling);
  } else {
    container.appendChild(canvas);
  }
  canvas.style.position = 'absolute';
  const frameRate = 60;

  // Re-make the white bar each time it goes offscreen.
  /** @type {?HTMLCanvasElement} */
  let whiteBar;
  const remakeWhiteBar = () => {
    whiteBar =
    /** @type {!HTMLCanvasElement} */ (document.createElement('canvas'));
    whiteBar.width = canvas.width;
    whiteBar.height = 12;
    const ctx =
    /** @type {CanvasRenderingContext2D} */ (whiteBar.getContext('2d'));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, whiteBar.width, whiteBar.height);
    let isWhite = true;
    ctx.fillStyle = '#FFF';
    for (let x = 0; x < whiteBar.width;) {
      const w = 5 + Math.random() * 4;
      if (isWhite) {
        ctx.globalAlpha = 0.75 + Math.random() * 0.25;
        ctx.fillRect(x, 0, w, whiteBar.height);
      }
      x += w;
      isWhite = !isWhite;
    }
  };

  // Construct a fixed pattern of "VHS tracking effects".
  let timer = 0;
  const timerLoopTime = frameRate * 100;
  const enabled = () => {
    // This process doesn't work for protected content.
    return player.drmInfo() == null;
  };
  let pattern = [];
  const generatePattern = () => {
    console.log('generating pattern');
    pattern = [];
    let lastOffset = 0;
    let lastCycle = 0;
    const add = (endCycle, endOffset) => {
      pattern.push({endCycle: endCycle, endOffset: endOffset});
      lastOffset = endOffset;
      lastCycle = endCycle;
    };
    add(0, 0);
    const timeOffset = 0.3 + Math.random() * 0.3;
    const moves = Math.floor(4 + Math.random() * 3);
    for (let i = 0; i < moves; i++) {
      let offset = 0;
      if (i == moves - 1) {
        offset = Math.round(lastOffset); // Move to the nearest side.
      } else if (i > 0) {
        if (lastOffset == 1 && Math.random() < 0.5) {
          // Loop around.
          add(lastCycle + 0.00001, 0);
          offset = Math.random() * 0.25;
        } else if (lastOffset == 0 && Math.random() < 0.5) {
          // Loop around.
          add(lastCycle + 0.00001, 1);
          offset = 1 - Math.random() * 0.25;
        } else {
          offset = lastOffset + (Math.random() * 2 - 1) * 0.3;
          offset = Math.min(Math.max(0, offset), 0);
          // Don't linger near the edge without crossing, it looks bad.
          if (offset != 0) {
            offset = Math.max(offset, 0.05);
          }
          if (offset != 1) {
            offset = Math.min(offset, 0.95);
          }
        }
      }
      const cycle = timeOffset + (1 - timeOffset) * i / moves;
      add(cycle, offset);
    }
  };
  generatePattern();
  const getOffsetMult = () => {
    const timerCycle = timer / timerLoopTime;
    let offset = 0;
    let startCycle = 0;
    let startOffset = 0;
    const moveBar = (endCycle, endOffset) => {
      if (timerCycle >= startCycle && timerCycle < endCycle) {
        const p = (timerCycle - startCycle) / (endCycle - startCycle);
        offset = p * endOffset + (1 - p) * startOffset;
      }
      startCycle = endCycle;
      startOffset = endOffset;
    };
    for (const obj of pattern) {
      moveBar(obj.endCycle, obj.endOffset);
    }
    return offset;
  };

  player.addEventListener('unloading', () => {
    // Re-start the tracking effect.
    timer = 0;
    // Make a new pattern.
    generatePattern();
  });

  setInterval(() => {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx =
    /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.imageSmoothingEnabled = false;
    if (!enabled()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      if (!video.paused) {
        timer += player.getPlaybackRate();
        if (timer > timerLoopTime) {
          timer %= timerLoopTime;
          // Come up with a new pattern.
          generatePattern();
        }
      }
      const offset = canvas.height * getOffsetMult();
      ctx.drawImage(video, 0, -offset, canvas.width, canvas.height);
      if (offset != 0) {
        ctx.drawImage(
            video, 0, canvas.height - offset, canvas.width, canvas.height);
        if (!whiteBar) {
          remakeWhiteBar();
        }
        const whiteBarY = canvas.height - offset - whiteBar.height;
        ctx.drawImage(whiteBar,
            0, whiteBarY, canvas.width, whiteBar.height);
      } else {
        whiteBar = null;
      }
      if (!video.paused && Math.random() < 0.035) {
        // Draw colored lines that look like VHS damage.
        // These lines are drawn a series of colored rectangles, of varying
        // levels of opacity.
        const rectangleWidth = 8;
        const rectangleHeight = 5;
        const numRectangles = Math.max(15,
            Math.floor(Math.random() * 0.75 * canvas.width / rectangleWidth));
        const width = numRectangles * rectangleWidth;
        const startY = Math.random() * (canvas.height - rectangleHeight);
        const startX = Math.random() * (canvas.width - width);
        switch (Math.floor(Math.random() * 3)) {
          case 0:
            ctx.fillStyle = '#F00';
            break;
          case 1:
            ctx.fillStyle = '#0F0';
            break;
          case 2:
            ctx.fillStyle = '#00F';
            break;
        }
        for (let i = 0; i < numRectangles; i++) {
          ctx.globalAlpha = 0.2 + Math.random() * 0.35;
          ctx.fillRect(startX + i * rectangleWidth, startY,
              rectangleWidth, rectangleHeight);
        }
        ctx.globalAlpha = 1;
      }
    }
  }, 1000 / frameRate);
});
