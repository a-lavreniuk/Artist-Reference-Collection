import { describe, expect, it } from 'vitest';

import { extractPinUrlsFromBoardHtml, parsePinMediaFromHtml } from '../../../../browser-extension/lib/pinterest/pinParse.js';

describe('parsePinMediaFromHtml', () => {
  it('parses image pin from og:image', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Test pin" />
        <meta property="og:image" content="https://i.pinimg.com/736x/aa/bb/cc/image.jpg" />
      </head></html>
    `;
    const payload = parsePinMediaFromHtml(html, 'https://ru.pinterest.com/pin/111/');
    expect(payload?.mediaKind).toBe('image');
    expect(payload?.url).toContain('pinimg.com');
  });

  it('parses video pin from og:video and pin slice', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Video pin" />
        <meta property="og:video:url" content="https://v.pinimg.com/videos/mc/720p/aa/bb/cc/video.mp4" />
      </head>
      <body>
        <div data-test-id="pin-closeup-video"></div>
        <script>{"id":"222","is_video":true}</script>
      </body></html>
    `;
    const payload = parsePinMediaFromHtml(html, 'https://ru.pinterest.com/pin/222/');
    expect(payload?.mediaKind).toBe('video');
    expect(payload?.url).toContain('.mp4');
  });

  it('extracts pin URLs from board HTML', () => {
    const html = `
      <a href="/pin/111/">one</a>
      <a href="https://ru.pinterest.com/pin/222/">two</a>
      <a href="/pin/111/">dup</a>
    `;
    const pins = extractPinUrlsFromBoardHtml(html, 'https://ru.pinterest.com/user/board/');
    expect(pins.map((p) => p.website)).toEqual([
      'https://ru.pinterest.com/pin/111/',
      'https://ru.pinterest.com/pin/222/'
    ]);
  });

  it('prefers images_orig over og:image thumbnail', () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://i.pinimg.com/236x/aa/bb/cc/small.jpg" />
      </head>
      <body>
        <script>{"entityId":"333","images_orig":{"url":"https://i.pinimg.com/originals/aa/bb/cc/full.jpg"}}</script>
      </body></html>
    `;
    const payload = parsePinMediaFromHtml(html, 'https://ru.pinterest.com/pin/333/');
    expect(payload?.mediaKind).toBe('image');
    expect(payload?.url).toContain('/originals/aa/bb/cc/full.jpg');
    expect(payload?.fallbackUrl).toBeUndefined();
  });

  it('parses v1.pinimg video from embedded JSON', () => {
    const pinId = '675821487865257612';
    const html = `
      <html><head>
        <meta property="og:title" content="Video pin" />
        <meta property="og:image" content="https://i.pinimg.com/originals/e3/b6/43/e3b643749310046ffab2b74a77987f24.jpg" />
      </head>
      <body>
        <script>
          {"entityId":"${pinId}","storyPinData":{"pages":[{"blocks":[{"video_list":{"vHLSV4":{"url":"https://v1.pinimg.com/videos/iht/hls/51/c4/4d/51c44d409861aad754c174b87111f07f.m3u8"}},"video":{"url":"https://v1.pinimg.com/videos/iht/720p/51/c4/4d/51c44d409861aad754c174b87111f07f.mp4"}}]}}]}}
        </script>
      </body></html>
    `;
    const payload = parsePinMediaFromHtml(html, `https://ru.pinterest.com/pin/${pinId}/`);
    expect(payload?.mediaKind).toBe('video');
    expect(payload?.url).toContain('v1.pinimg.com');
    expect(payload?.url).toContain('.mp4');
  });

  it.skipIf(!process.env.ARC_PIN_DIAG)('diagnoses board pin media kinds', async () => {
    const pins = [
      '80924124549755117',
      '80924124549755116',
      '80924124550524472',
      '80924124549817823',
      '675821487865257612'
    ];

    for (const id of pins) {
      const url = `https://ru.pinterest.com/pin/${id}/`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9'
        }
      });
      const html = await res.text();
      const payload = parsePinMediaFromHtml(html, url);
      // eslint-disable-next-line no-console
      console.log(id, payload?.mediaKind, payload?.url?.slice(0, 100));
    }
  });

  it.skipIf(!process.env.ARC_PIN_FETCH)('fetches live Pinterest pins', async () => {
    const pins = [
      '80924124549755117',
      '80924124549755116',
      '80924124550524472',
      '80924124549817823',
      '675821487865257612'
    ];

    for (const id of pins) {
      const url = `https://ru.pinterest.com/pin/${id}/`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9'
        }
      });
      const html = await res.text();
      const payload = parsePinMediaFromHtml(html, url);
      expect(payload?.url, `pin ${id}`).toBeTruthy();
    }
  });
});
