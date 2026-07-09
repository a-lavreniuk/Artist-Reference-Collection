import { describe, expect, it } from 'vitest';

import {
  buildArtstationCardName,
  extractArtworkUrlsFromPortfolioHtml,
  parseArtstationArtworkFromHtml,
  stripArtstationResizeSegment
} from '../../../../browser-extension/lib/artstation/artworkParse.js';

describe('parseArtstationArtworkFromHtml', () => {
  it('strips resize segment from artwork CDN URL', () => {
    const url =
      'https://cdnb.artstation.com/p/assets/images/images/000/000/001/large_square/art.jpg';
    expect(stripArtstationResizeSegment(url)).toContain('/images/000/000/001/art.jpg');
    expect(stripArtstationResizeSegment(url)).not.toContain('large_square');
  });

  it('parses artwork image from og:image', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Dragon — by Jane Doe" />
        <meta property="og:image" content="https://cdnb.artstation.com/p/assets/images/images/000/000/004/medium_square/art.jpg" />
      </head></html>
    `;
    const artwork = parseArtstationArtworkFromHtml(html, 'https://www.artstation.com/artwork/Baorl4');
    expect(artwork?.artworkId).toBe('Baorl4');
    expect(artwork?.images[0].url).not.toContain('medium_square');
    expect(artwork?.images[0].name).toContain('Dragon');
  });

  it('parses video artwork when og:video is present', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Process video — by Jane Doe" />
        <meta property="og:video:url" content="https://cdna.artstation.com/video.mp4" />
      </head></html>
    `;
    const artwork = parseArtstationArtworkFromHtml(html, 'https://www.artstation.com/artwork/video1');
    expect(artwork?.mediaKind).toBe('video');
    expect(artwork?.videoUrl).toContain('.mp4');
  });

  it('parses multiple images from data-image attributes', () => {
    const html = `
      <html><head><meta property="og:title" content="Series — by Jane Doe" /></head>
      <body>
        <div data-image="https://cdnb.artstation.com/p/assets/images/images/000/000/010/large_square/a.jpg"></div>
        <div data-image="https://cdnb.artstation.com/p/assets/images/images/000/000/010/large_square/b.jpg"></div>
      </body></html>
    `;
    const artwork = parseArtstationArtworkFromHtml(html, 'https://www.artstation.com/artwork/Series1');
    expect(artwork?.images.length).toBeGreaterThanOrEqual(2);
  });

  it('builds card names with slide suffix', () => {
    expect(buildArtstationCardName('Title', 'Author', 0, 2)).toBe('Title — Author — 1/2');
  });

  it('extracts artwork URLs from portfolio HTML', () => {
    const html = `
      <a href="/artwork/Baorl4">one</a>
      <a href="https://www.artstation.com/artwork/AbCd12">two</a>
    `;
    const artworks = extractArtworkUrlsFromPortfolioHtml(html, 'https://www.artstation.com/artist');
    expect(artworks).toHaveLength(2);
    expect(artworks[0].artworkId).toBe('Baorl4');
  });
});
