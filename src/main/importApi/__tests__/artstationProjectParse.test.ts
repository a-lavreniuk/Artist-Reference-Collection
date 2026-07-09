import { describe, expect, it } from 'vitest';

import {
  buildArtstationProjectCardName,
  parseArtstationProjectJson
} from '../../../../browser-extension/lib/artstation/projectParse.js';

describe('parseArtstationProjectJson', () => {
  it('parses all image assets from project JSON', () => {
    const data = {
      title: 'Sketches',
      user: { full_name: 'Jane Doe', username: 'jane' },
      assets: [
        { id: 1, has_image: true, image_url: 'https://cdnb.artstation.com/p/assets/images/images/000/000/010/large_square/a.jpg' },
        { id: 2, has_image: true, image_url: 'https://cdnb.artstation.com/p/assets/images/images/000/000/010/large_square/b.jpg' },
        { id: 3, has_image: true, image_url: 'https://cdnb.artstation.com/p/assets/images/images/000/000/010/large_square/c.jpg' }
      ]
    };

    const artwork = parseArtstationProjectJson(data, 'https://www.artstation.com/artwork/Baorl4');
    expect(artwork?.images).toHaveLength(3);
    expect(artwork?.images[0].url).not.toContain('large_square');
    expect(artwork?.images[1].name).toContain('2/3');
  });

  it('builds card names with slide suffix', () => {
    expect(buildArtstationProjectCardName('Title', 'Author', 1, 4)).toBe('Title — Author — 2/4');
  });
});
