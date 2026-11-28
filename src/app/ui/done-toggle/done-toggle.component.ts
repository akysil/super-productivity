import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { isMultiSelectModifierEvent } from '../../util/is-multi-select-modifier-event';
import { isTouchActive } from '../../util/input-intent';
import { performHapticFeedback } from '../../util/haptic-feedback';

@Component({
  selector: 'done-toggle',
  templateUrl: './done-toggle.component.html',
  styleUrl: './done-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  /* eslint-disable @typescript-eslint/naming-convention */
  host: {
    '(click)': 'onClick($event)',
    '(keydown.enter)': 'emitToggle(); $event.stopPropagation()',
    '(keydown.space)': 'emitToggle(); $event.stopPropagation(); $event.preventDefault()',
    '[attr.role]': "isPlayToggle() ? 'button' : 'checkbox'",
    '[attr.aria-checked]': 'isPlayToggle() ? null : isDone()',
    tabindex: '0',
    '[class.is-done]': '(showDoneAnimation() || isDone()) && !showUndoneAnimation()',
    '[class.is-current]': 'isCurrent()',
    '[class.is-scale-up]': 'showDoneAnimation() || showUndoneAnimation()',
  },
  /* eslint-enable @typescript-eslint/naming-convention */
})
export class DoneToggleComponent {
  readonly isDone = input.required<boolean>();
  /** Draws a cross instead of a checkmark. Only ever set on a done task. */
  readonly isWontDo = input<boolean>(false);
  readonly isCurrent = input<boolean>(false);
  readonly showDoneAnimation = input<boolean>(false);
  readonly showUndoneAnimation = input<boolean>(false);
  /**
   * Opt in where the surrounding row supports multi-select (the task list).
   * Off by default: the Planner renders this same toggle and has no
   * multi-select, so a modifier click there must still mark the task done —
   * bailing unconditionally swallowed the toggle and let the click bubble to
   * the planner row, which opened the detail panel instead.
   */
  readonly isMultiSelectAware = input<boolean>(false);
  /**
   * Makes the toggle start and pause time tracking instead of toggling done.
   * The task row sets it on touch, where swiping right already marks a task
   * done and the hover play button is out of reach (#10122). A muted play
   * triangle shows the action; the current task keeps its accent triangle.
   */
  readonly isPlayToggle = input<boolean>(false);
  readonly toggled = output<void>();
  readonly playToggled = output<void>();

  readonly isTouchActive = isTouchActive;

  onClick(ev: MouseEvent): void {
    // A modifier click selects the task row instead of toggling done; let it
    // bubble to the row.
    if (this.isMultiSelectAware() && isMultiSelectModifierEvent(ev)) {
      return;
    }
    // Confirm completing a task by tap, like a native checkbox. Not on undo,
    // and not for keyboard or mouse toggles.
    if (!this.isPlayToggle() && this.isTouchActive() && !this.isDone()) {
      performHapticFeedback('confirm');
    }
    this.emitToggle();
    ev.stopPropagation();
  }

  emitToggle(): void {
    if (this.isPlayToggle()) {
      this.playToggled.emit();
    } else {
      this.toggled.emit();
    }
  }
}
