import test from 'node:test';
import assert from 'node:assert/strict';
import { gallerySlides, createGalleryVideoLoader } from '../../frontend/src/lib/galleryViewer.js';

const files = [
  { id: 1, originalname: 'photo.jpg', url: '/original.jpg', previewUrl: '/preview.jpg' },
  { id: 2, originalname: 'video.mov', url: '/original.mov', previewUrl: '/encoded.mp4', thumbnailUrl: '/poster.jpg' }
];

test('one gallery contains images and videos with original downloads and MP4 playback', () => {
  const slides = gallerySlides(files);
  assert.deepEqual(slides.map(slide => slide.type), ['image', 'html5video']);
  assert.equal(slides[1].src, '/encoded.mp4');
  assert.equal(slides[1].downloadSrc, '/original.mov');
  assert.equal(slides[1].downloadFilename, 'video.mov');
  assert.equal(gallerySlides([{ ...files[1], previewUrl: null }])[0].src, 'pending-video.mp4');
});

function videoFixture() {
  const video = {
    src: '', loads: 0, pauses: 0,
    load() { this.loads++ }, pause() { this.pauses++ },
    removeAttribute(name) { if (name === 'src') this.src = '' },
    parentElement: { append() {} }
  };
  return { video, slide: { ...gallerySlides(files)[1], el: { querySelector: () => video } } };
}
function fakeDocument() {
  globalThis.document = { createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }) };
}

test('only the selected video loads; switching to a photo stops video and releases its source', () => {
  const previous = globalThis.document;
  try {
    fakeDocument();
    const loader = createGalleryVideoLoader('gallery');
    assert.doesNotThrow(() => loader.sync({ getSlide: () => undefined }));
    const { slide, video } = videoFixture();
    loader.sync({ getSlide: () => slide });
    assert.equal(video.src, '/encoded.mp4');
    loader.sync({ getSlide: () => slide });
    assert.equal(video.loads, 1);
    loader.sync({ getSlide: () => gallerySlides(files)[0] });
    assert.equal(video.src, '');
    assert.equal(video.pauses, 1);
    loader.stop();
  } finally { globalThis.document = previous; }
});

test('leaving a pending video aborts polling and ignores late responses', async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    fakeDocument();
    let resolve;
    let signal;
    globalThis.fetch = (_url, options) => {
      signal = options.signal;
      return new Promise(done => { resolve = done; });
    };
    const loader = createGalleryVideoLoader('gallery');
    const { slide, video } = videoFixture();
    slide.media = { ...slide.media, previewUrl: null };
    loader.sync({ getSlide: () => slide });
    assert.equal(video.src, '');
    loader.stop();
    assert.equal(signal.aborted, true);
    resolve(Response.json({ status: 'ready', url: '/late.mp4' }));
    await new Promise(done => setImmediate(done));
    assert.equal(video.src, '');
    assert.equal(video.loads, 1);
  } finally { globalThis.document = previousDocument; globalThis.fetch = previousFetch; }
});
