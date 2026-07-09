import { describe, expect, it } from 'vitest';

import {
  buildInstagramCardName,
  extractPostUrlsFromSavedHtml,
  extractShortcodeFromPostUrl,
  parseInstagramPostFromHtml
} from '../../../../browser-extension/lib/instagram/postParse.js';

describe('parseInstagramPostFromHtml', () => {
  it('extracts shortcode from post URL', () => {
    expect(extractShortcodeFromPostUrl('https://www.instagram.com/p/Dagz8GXGj-Y/')).toBe('Dagz8GXGj-Y');
  });

  it('parses single image post from og:image', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Artist on Instagram: &quot;Caption text&quot;" />
        <meta property="og:description" content="Caption text" />
        <meta property="og:image" content="https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/abc.jpg" />
      </head></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/Dagz8GXGj-Y/');
    expect(post?.shortcode).toBe('Dagz8GXGj-Y');
    expect(post?.images).toHaveLength(1);
    expect(post?.images[0].url).toContain('cdninstagram.com');
    expect(post?.images[0].name).toContain('@');
  });

  it('parses carousel images from embedded JSON', () => {
    const html = `
      <html><head><meta property="og:title" content="Artist on Instagram" /></head>
      <body>
        <script>
          {"shortcode":"Dagz8GXGj-Y","display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/one.jpg","edge_sidecar_to_children":{"edges":[
            {"node":{"display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/one.jpg"}},
            {"node":{"display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/two.jpg"}},
            {"node":{"display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/three.jpg"}}
          ]}}
        </script>
      </body></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/Dagz8GXGj-Y/');
    expect(post?.images.length).toBeGreaterThanOrEqual(2);
  });

  it('builds card names with slide suffix for carousel', () => {
    expect(buildInstagramCardName('Caption', 'artist', 1, 3)).toBe('Caption — @artist — 2/3');
  });

  it('extracts post URLs from saved collection HTML', () => {
    const html = `
      <a href="/p/AbCdEf1/">one</a>
      <a href="https://www.instagram.com/p/XyZ9876/">two</a>
      <a href="/p/AbCdEf1/">dup</a>
    `;
    const posts = extractPostUrlsFromSavedHtml(html, 'https://www.instagram.com/user/saved/refs/');
    expect(posts).toHaveLength(2);
    expect(posts[0].shortcode).toBe('AbCdEf1');
  });

  it('rejects instagram UI icon URLs', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Artist on Instagram" />
        <meta property="og:image" content="https://static.cdninstagram.com/rsrc.php/v3/yz/r/abc.webp" />
      </head>
      <body>
        <script>"display_url":"https://static.cdninstagram.com/rsrc.php/v3/yz/r/icon.webp"</script>
      </body></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/IconTest/');
    expect(post).toBeNull();
  });

  it('accepts scontent URLs with non-t51 path prefixes', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Artist on Instagram" />
        <meta property="og:image" content="https://scontent-ams2-1.cdninstagram.com/v/t16.0-10/abc.jpg" />
      </head></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/PathTest/');
    expect(post?.images).toHaveLength(1);
    expect(post?.images[0].url).toContain('/v/t16.0-10/');
  });

  it('ignores display_urls from other posts on the same page', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Artist on Instagram" />
        <meta property="og:image" content="https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/main.jpg" />
      </head>
      <body>
        <script>
          {"shortcode":"Dagz8GXGj-Y","display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/main.jpg"}
          {"shortcode":"OtherPost1","display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/related1.jpg"}
          {"shortcode":"OtherPost2","display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/related2.jpg"}
        </script>
      </body></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/Dagz8GXGj-Y/');
    expect(post?.images).toHaveLength(1);
    expect(post?.images[0].url).toContain('main.jpg');
  });

  it('parses carousel from carousel_media JSON', () => {
    const html = `
      <html><head><meta property="og:title" content="Artist on Instagram" /></head>
      <body>
        <script>
          {"code":"Dagz8GXGj-Y","carousel_media":[
            {"image_versions2":{"candidates":[{"url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/111_222_n.jpg"},{"url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/111_222_n_small.jpg"}]}},
            {"image_versions2":{"candidates":[{"url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/333_444_n.jpg"}]}}
          ]}
        </script>
      </body></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/Dagz8GXGj-Y/');
    expect(post?.images).toHaveLength(2);
  });

  it('dedupes multiple resolutions of the same slide', () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Artist on Instagram" />
        <meta property="og:image" content="https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/111_222_n.jpg" />
      </head>
      <body>
        <script>
          {"shortcode":"Dagz8GXGj-Y","display_url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/111_222_n.jpg","image_versions2":{"candidates":[{"url":"https://scontent-ams2-1.cdninstagram.com/v/t51.2885-15/111_222_n_small.jpg"}]}}
        </script>
      </body></html>
    `;
    const post = parseInstagramPostFromHtml(html, 'https://www.instagram.com/p/Dagz8GXGj-Y/');
    expect(post?.images).toHaveLength(1);
  });
});
