import { monthOf, monthWeeks, parseIsoDate, shiftMonth, type CalendarMonth, type IsoDate } from "../core/dates.ts";

/*
 * An inline calendar drawn inside the popup's own DOM.
 *
 * Firefox, and Firefox-based browsers like Zen, render the native
 * <input type="date"> picker as a separate browser popup, which can open
 * behind the extension popup and cannot be raised from page CSS. Drawing the
 * calendar in-page sidesteps that in every browser.
 */

export interface DatePickerParts {
  /** Text field that holds the chosen day as YYYY-MM-DD. */
  readonly input: HTMLInputElement;
  readonly toggle: HTMLButtonElement;
  /** Empty container the calendar is rendered into. */
  readonly panel: HTMLElement;
}

export interface DatePicker {
  close(): void;
}

export function attachDatePicker(parts: DatePickerParts, today: () => IsoDate): DatePicker {
  const { input, toggle, panel } = parts;
  let shownMonth: CalendarMonth = monthOf(today());

  function open(): void {
    shownMonth = monthOf(parseIsoDate(input.value.trim()) ?? today());
    render();
    setOpen(true);
  }

  function close(): void {
    setOpen(false);
  }

  function setOpen(isOpen: boolean): void {
    panel.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
  }

  function choose(day: IsoDate): void {
    input.value = day;
    close();
    input.focus();
  }

  function showMonth(delta: number): void {
    shownMonth = shiftMonth(shownMonth, delta);
    render();
  }

  function render(): void {
    const selected = parseIsoDate(input.value.trim());
    panel.replaceChildren(
      renderMonthNav(shownMonth, showMonth),
      renderDayGrid(shownMonth, { selected, today: today() }, choose),
    );
  }

  toggle.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
    toggle.focus();
  });

  close();
  return { close };
}

function renderMonthNav(month: CalendarMonth, onShift: (delta: number) => void): HTMLDivElement {
  const nav = document.createElement("div");
  nav.className = "date-picker-nav";

  const previous = navButton("‹", "Previous month", () => onShift(-1));
  const next = navButton("›", "Next month", () => onShift(1));
  const title = document.createElement("span");
  title.className = "date-picker-title";
  title.textContent = formatMonthTitle(month);

  nav.append(previous, title, next);
  return nav;
}

interface HighlightedDays {
  readonly selected: IsoDate | null;
  readonly today: IsoDate;
}

function renderDayGrid(month: CalendarMonth, highlighted: HighlightedDays, onChoose: (day: IsoDate) => void): HTMLDivElement {
  const grid = document.createElement("div");
  grid.className = "date-picker-grid";

  for (const name of weekdayInitials()) {
    const heading = document.createElement("span");
    heading.className = "date-picker-weekday";
    heading.textContent = name;
    grid.append(heading);
  }

  for (const day of monthWeeks(month).flat()) {
    grid.append(day === null ? document.createElement("span") : dayButton(day, highlighted, onChoose));
  }
  return grid;
}

function dayButton(day: IsoDate, highlighted: HighlightedDays, onChoose: (day: IsoDate) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "date-picker-day";
  button.textContent = String(Number(day.slice(8)));
  button.setAttribute("aria-label", day);
  if (day === highlighted.today) button.classList.add("today");
  if (day === highlighted.selected) {
    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
  }
  button.addEventListener("click", () => onChoose(day));
  return button;
}

function navButton(text: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button date-picker-step";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

// Formatted in UTC so the label can't slip into a neighbouring month in any time zone.
function formatMonthTitle({ year, month }: CalendarMonth): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(Date.UTC(year, month - 1, 1));
}

/** Sunday-first, matching monthWeeks. 2023-01-01 was a Sunday. */
function weekdayInitials(): string[] {
  const format = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, offset) => format.format(Date.UTC(2023, 0, 1 + offset)));
}
