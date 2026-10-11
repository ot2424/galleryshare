import test from 'node:test';
import assert from 'node:assert/strict';
import { sortGalleryFiles } from '../../frontend/src/lib/gallerySort.js';

test('date sorting uses file dates, upload fallback, ISO dates and puts undated files last', () => {
  const files = [
    { id: 4, originalname: 'a.jpg' },
    { id: 3, originalname: 'b.jpg', uploadedAt: '2026-10-03T00:00:00Z' },
    { id: 2, originalname: 'c.jpg', lastModified: Date.parse('2026-10-01'), uploadedAt: Date.parse('2026-10-04') },
    { id: 1, originalname: 'd.jpg', lastModified: 'invalid', uploadedAt: Date.parse('2026-10-02') }
  ];
  assert.deepEqual(sortGalleryFiles(files).map(f => f.id), [2, 1, 3, 4]);
  assert.deepEqual(sortGalleryFiles(files, 'date-desc').map(f => f.id), [3, 1, 2, 4]);
  assert.deepEqual(files.map(f => f.id), [4, 3, 2, 1]);
});

test('name sorting respects numbers and works in both directions', () => {
  const files = [{ originalname: 'IMG10.jpg' }, { originalname: 'img2.jpg' }, { filename: 'a.jpg' }];
  assert.deepEqual(sortGalleryFiles(files, 'name-asc'), [files[2], files[1], files[0]]);
  assert.deepEqual(sortGalleryFiles(files, 'name-desc'), [files[0], files[1], files[2]]);
});

test('legacy files use registration order when dates are unavailable', () => {
  const files = [{ id: 3 }, { id: 1 }, { id: 2 }];
  assert.deepEqual(sortGalleryFiles(files).map(f => f.id), [1, 2, 3]);
});
