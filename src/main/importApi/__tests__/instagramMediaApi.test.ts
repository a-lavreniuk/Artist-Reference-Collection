import { describe, expect, it } from 'vitest';

import {
  buildInstagramMediaInfoUrl,
  parseInstagramMediaInfoResponse,
  pickBestImageUrlFromApiSlide,
  shortcodeToMediaId
} from '../../../../browser-extension/lib/instagram/mediaApi.js';

describe('instagram media API helpers', () => {
  it('converts shortcode to media id', () => {
    expect(shortcodeToMediaId('Dagz8GXGj-Y')).toBe('3936374504692531096');
  });

  it('builds media info URL', () => {
    expect(buildInstagramMediaInfoUrl('Dagz8GXGj-Y')).toBe(
      'https://www.instagram.com/api/v1/media/3936374504692531096/info/'
    );
  });

  it('picks largest candidate from slide', () => {
    const url = pickBestImageUrlFromApiSlide({
      image_versions2: {
        candidates: [
          { url: 'https://scontent.cdninstagram.com/v/small.jpg', width: 320, height: 320 },
          { url: 'https://scontent.cdninstagram.com/v/large.jpg', width: 1440, height: 1440 }
        ]
      }
    });

    expect(url).toBe('https://scontent.cdninstagram.com/v/large.jpg');
  });

  it('parses carousel media from API response', () => {
    const urls = parseInstagramMediaInfoResponse({
      items: [
        {
          carousel_media: [
            {
              image_versions2: {
                candidates: [{ url: 'https://scontent.cdninstagram.com/v/a.jpg', width: 1080, height: 1080 }]
              }
            },
            {
              image_versions2: {
                candidates: [{ url: 'https://scontent.cdninstagram.com/v/b.jpg', width: 1080, height: 1080 }]
              }
            }
          ]
        }
      ]
    });

    expect(urls).toEqual([
      'https://scontent.cdninstagram.com/v/a.jpg',
      'https://scontent.cdninstagram.com/v/b.jpg'
    ]);
  });

  it('parses single-image API response', () => {
    const urls = parseInstagramMediaInfoResponse({
      items: [
        {
          image_versions2: {
            candidates: [{ url: 'https://scontent.cdninstagram.com/v/one.jpg', width: 1080, height: 1080 }]
          }
        }
      ]
    });

    expect(urls).toEqual(['https://scontent.cdninstagram.com/v/one.jpg']);
  });
});
