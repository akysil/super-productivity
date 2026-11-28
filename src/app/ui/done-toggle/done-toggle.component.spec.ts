import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DoneToggleComponent } from './done-toggle.component';

@Component({
  standalone: true,
  imports: [DoneToggleComponent],
  template: `
    <done-toggle
      [isDone]="isDone()"
      [isWontDo]="isWontDo()"
      [isMultiSelectAware]="isMultiSelectAware()"
      [isCurrent]="isCurrent()"
      [isPlayToggle]="isPlayToggle()"
      (toggled)="toggledCount = toggledCount + 1"
      (playToggled)="playToggledCount = playToggledCount + 1"
    ></done-toggle>
  `,
})
class HostComponent {
  readonly isMultiSelectAware = signal(false);
  readonly isDone = signal(false);
  readonly isWontDo = signal(false);
  readonly isCurrent = signal(false);
  readonly isPlayToggle = signal(false);
  toggledCount = 0;
  playToggledCount = 0;
}

describe('DoneToggleComponent', () => {
  const clickWith = (
    init: MouseEventInit,
  ): { host: HostComponent; ev: MouseEvent; el: HTMLElement } => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('done-toggle') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    return { host: fixture.componentInstance, ev, el };
  };

  it('toggles and stops propagation on a plain click', () => {
    const { host, ev, el } = clickWith({});
    const stopped = spyOn(ev, 'stopPropagation');
    el.dispatchEvent(ev);
    expect(host.toggledCount).toBe(1);
    expect(stopped).toHaveBeenCalled();
  });

  // The Planner uses this same component and has no multi-select, so a
  // modifier click there must keep marking the task done. Bailing
  // unconditionally swallowed the toggle AND let the click bubble to the
  // planner row, which opened the detail panel instead.
  it('toggles on a modifier click when the host is not multi-select aware', () => {
    const { host, ev, el } = clickWith({ ctrlKey: true });
    const stopped = spyOn(ev, 'stopPropagation');
    el.dispatchEvent(ev);
    expect(host.toggledCount).toBe(1);
    // The other half of the reported symptom: the swallowed toggle ALSO let the
    // click reach the planner row, which opened the detail panel. Emitting
    // without stopping here would still leave that behaviour broken.
    expect(stopped).toHaveBeenCalled();
  });

  // A task finished as "won't do" is done, so it keeps the shared `done-check`
  // styling and swaps only the glyph.
  describe('wont do', () => {
    const glyphFor = (isWontDo: boolean): SVGElement | null => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.isDone.set(true);
      fixture.componentInstance.isWontDo.set(isWontDo);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('.done-check');
    };

    it('draws a checkmark for a normally completed task', () => {
      const glyph = glyphFor(false);
      expect(glyph?.tagName).toBe('polyline');
      expect(glyph?.classList).not.toContain('done-check--cross');
    });

    it('draws a cross instead of the checkmark', () => {
      const glyph = glyphFor(true);
      expect(glyph?.tagName).toBe('path');
      expect(glyph?.classList).toContain('done-check--cross');
    });
  });

  it('lets a modifier click bubble untouched when the host is multi-select aware', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.isMultiSelectAware.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('done-toggle') as HTMLElement;
    const ev = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    });
    const stopped = spyOn(ev, 'stopPropagation');
    el.dispatchEvent(ev);
    expect(fixture.componentInstance.toggledCount).toBe(0);
    expect(stopped).not.toHaveBeenCalled();
  });

  // #10122: on touch the task row turns the toggle into the start/pause
  // control of time tracking; swiping right marks the task done.
  describe('play toggle', () => {
    const setup = (
      opts: { isPlayToggle: boolean; isCurrent?: boolean } = { isPlayToggle: true },
    ): { host: HostComponent; el: HTMLElement } => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.isPlayToggle.set(opts.isPlayToggle);
      fixture.componentInstance.isCurrent.set(!!opts.isCurrent);
      fixture.detectChanges();
      return {
        host: fixture.componentInstance,
        el: fixture.nativeElement.querySelector('done-toggle') as HTMLElement,
      };
    };

    it('emits playToggled instead of toggled on a tap', () => {
      const { host, el } = setup();
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopped = spyOn(ev, 'stopPropagation');
      el.dispatchEvent(ev);
      expect(host.playToggledCount).toBe(1);
      expect(host.toggledCount).toBe(0);
      expect(stopped).toHaveBeenCalled();
    });

    it('emits playToggled on Enter and Space', () => {
      const { host, el } = setup();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(host.playToggledCount).toBe(2);
      expect(host.toggledCount).toBe(0);
    });

    it('is a button, not a checkbox', () => {
      const { el } = setup();
      expect(el.getAttribute('role')).toBe('button');
      expect(el.hasAttribute('aria-checked')).toBe(false);
    });

    it('stays a checkbox that toggles done when off', () => {
      const { host, el } = setup({ isPlayToggle: false });
      expect(el.getAttribute('role')).toBe('checkbox');
      expect(el.getAttribute('aria-checked')).toBe('false');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(host.toggledCount).toBe(1);
      expect(host.playToggledCount).toBe(0);
      expect(el.querySelector('.play-indicator')).toBeNull();
    });

    it('draws a muted play triangle on a task that is not tracking', () => {
      const { el } = setup();
      const triangle = el.querySelector('.play-indicator');
      expect(triangle).not.toBeNull();
      expect(triangle?.classList).toContain('play-indicator--idle');
    });

    it('keeps the accent triangle of the current task', () => {
      const { el } = setup({ isPlayToggle: true, isCurrent: true });
      const triangle = el.querySelector('.play-indicator');
      expect(triangle).not.toBeNull();
      expect(triangle?.classList).not.toContain('play-indicator--idle');
    });
  });

  describe('haptic feedback', () => {
    const win = window as { SUPAndroid?: unknown };
    let original: unknown;
    let haptic: jasmine.Spy;

    beforeEach(() => {
      original = win.SUPAndroid;
      haptic = jasmine.createSpy('performHapticFeedback');
      win.SUPAndroid = { performHapticFeedback: haptic };
    });

    afterEach(() => {
      win.SUPAndroid = original;
    });

    const setup = (
      opts: { isTouch: boolean; isDone?: boolean; isMultiSelectAware?: boolean } = {
        isTouch: true,
      },
    ): { host: HostComponent; el: HTMLElement } => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.componentInstance.isDone.set(!!opts.isDone);
      fixture.componentInstance.isMultiSelectAware.set(!!opts.isMultiSelectAware);
      fixture.detectChanges();
      const de = fixture.debugElement.query(By.directive(DoneToggleComponent));
      spyOn(de.componentInstance as DoneToggleComponent, 'isTouchActive').and.returnValue(
        opts.isTouch,
      );
      return { host: fixture.componentInstance, el: de.nativeElement as HTMLElement };
    };

    const click = (el: HTMLElement, init: MouseEventInit = {}): void => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
    };

    it('confirms completing a task by tap', () => {
      const { host, el } = setup({ isTouch: true });
      click(el);
      expect(haptic).toHaveBeenCalledOnceWith('confirm');
      expect(host.toggledCount).toBe(1);
    });

    it('stays silent when undoing a done task', () => {
      const { host, el } = setup({ isTouch: true, isDone: true });
      click(el);
      expect(haptic).not.toHaveBeenCalled();
      expect(host.toggledCount).toBe(1);
    });

    it('stays silent for a mouse click', () => {
      const { el } = setup({ isTouch: false });
      click(el);
      expect(haptic).not.toHaveBeenCalled();
    });

    it('stays silent for a keyboard toggle', () => {
      const { host, el } = setup({ isTouch: true });
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(host.toggledCount).toBe(1);
      expect(haptic).not.toHaveBeenCalled();
    });

    it('stays silent for a multi-select modifier click', () => {
      const { host, el } = setup({ isTouch: true, isMultiSelectAware: true });
      click(el, { ctrlKey: true });
      expect(host.toggledCount).toBe(0);
      expect(haptic).not.toHaveBeenCalled();
    });
  });
});
