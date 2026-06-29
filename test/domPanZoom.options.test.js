import { afterEach, describe, expect, it, vi } from 'vitest';
import domPanZoom from '../src/index.js';
import { createFixture, dispatchWheel } from './helpers.js';

describe('domPanZoom options', () => {
  /** @type {ReturnType<typeof createFixture>[]} */
  const fixtures = [];

  afterEach(() => {
    while (fixtures.length) {
      fixtures.pop().destroy();
    }
  });

  function setup(options) {
    const fixture = createFixture(options);
    fixtures.push(fixture);
    return fixture;
  }

  it('panEnabled false removes the grab cursor', () => {
    const { wrapper } = setup({ panEnabled: false });

    expect(wrapper.style.cursor).toBeFalsy();
  });

  it('panEnabled true sets the grab cursor', () => {
    const { wrapper } = setup({ panEnabled: true });

    expect(wrapper.style.cursor).toBe('grab');
  });

  it('zoomEnabled false ignores wheel zoom', () => {
    const { wrapper, instance } = setup({ zoomEnabled: false, initialZoom: 1 });

    dispatchWheel(wrapper, { deltaY: -120 });

    expect(instance.getZoom()).toBe(1);
  });

  it('mouseWheelRequiresKey true blocks wheel zoom without a modifier', () => {
    const { wrapper, instance } = setup({
      mouseWheelRequiresKey: true,
      initialZoom: 1
    });

    dispatchWheel(wrapper, { deltaY: -120 });

    expect(instance.getZoom()).toBe(1);
  });

  it('mouseWheelRequiresKey true allows wheel zoom with a modifier', () => {
    const { instance } = setup({
      mouseWheelRequiresKey: true,
      initialZoom: 1
    });

    expect(
      instance.isMouseWheelZoomAllowed({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false })
    ).toBe(true);
    expect(
      instance.isMouseWheelZoomAllowed({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false })
    ).toBe(false);
  });

  it('wheel zoom works when mouseWheelRequiresKey is disabled', () => {
    const { wrapper, instance } = setup({
      mouseWheelRequiresKey: false,
      initialZoom: 1
    });

    dispatchWheel(wrapper, { deltaY: -120 });

    expect(instance.getZoom()).toBeGreaterThan(1);
  });

  it('mouseWheelRequiresKey accepts a custom function', () => {
    const allowWheel = vi.fn(() => false);
    const { wrapper, instance } = setup({
      mouseWheelRequiresKey: allowWheel,
      initialZoom: 1
    });

    dispatchWheel(wrapper, { deltaY: -120 });

    expect(allowWheel).toHaveBeenCalled();
    expect(instance.getZoom()).toBe(1);
  });

  it('dblClickZoomEnabled zooms in at the cursor position', () => {
    const { wrapper, instance } = setup({
      dblClickZoomEnabled: true,
      initialZoom: 1,
      zoomStep: 50
    });

    wrapper.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 400,
        clientY: 200,
        bubbles: true,
        cancelable: true
      })
    );

    expect(instance.getZoom()).toBe(1.5);
  });

  it('dblClickZoomEnabled respects zoomEnabled false', () => {
    const { wrapper, instance } = setup({
      dblClickZoomEnabled: true,
      zoomEnabled: false,
      initialZoom: 1
    });

    wrapper.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 400,
        clientY: 200,
        bubbles: true,
        cancelable: true
      })
    );

    expect(instance.getZoom()).toBe(1);
  });

  it('destroy removes listeners so a replaced instance respects new options', () => {
    const { wrapper, content, instance: first } = setup({
      zoomEnabled: true,
      initialZoom: 1
    });

    first.destroy();

    const second = new domPanZoom({
      wrapperElement: wrapper,
      panZoomElement: content,
      bounds: false,
      initialZoom: 1,
      center: true,
      transitionSpeed: 0,
      zoomEnabled: false
    });

    dispatchWheel(wrapper, { deltaY: -120 });

    expect(second.getZoom()).toBe(1);
    second.destroy();
  });
});
