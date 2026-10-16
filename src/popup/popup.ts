import {
  createCoupon,
  describeExpiry,
  groupLiveCouponsByExpiry,
  markDeleted,
  updateCoupon,
  upsertCoupon,
  validateDraft,
  type Coupon,
  type CouponDraft,
  type DraftErrors,
} from "../core/coupon.ts";
import { toLocalIsoDate, type IsoDate } from "../core/dates.ts";
import { loadCoupons, saveCoupons } from "../shell/storage.ts";
import { attachDatePicker } from "./date-picker.ts";

/*
 * Storage is the single owner of coupon state. Every change is written
 * through saveCoupons and the popup then re-renders from what it saved;
 * `view.coupons` is only a snapshot of the last load or save.
 */

interface PopupView {
  coupons: Coupon[];
  /** Coupon being edited in the form, or null when adding a new one. */
  editingId: string | null;
  /** Coupon whose delete button was clicked once and awaits confirmation. */
  pendingDeleteId: string | null;
}

const elements = {
  addButton: requireElement<HTMLButtonElement>("add-button"),
  cancelButton: requireElement<HTMLButtonElement>("cancel-button"),
  form: requireElement<HTMLFormElement>("coupon-form"),
  emptyState: requireElement<HTMLParagraphElement>("empty-state"),
  activeList: requireElement<HTMLUListElement>("active-list"),
  expiredSection: requireElement<HTMLElement>("expired-section"),
  expiredList: requireElement<HTMLUListElement>("expired-list"),
};

const view: PopupView = { coupons: [], editingId: null, pendingDeleteId: null };

const expiryPicker = attachDatePicker(
  {
    input: requireElement<HTMLInputElement>("expires-on"),
    toggle: requireElement<HTMLButtonElement>("date-picker-toggle"),
    panel: requireElement<HTMLElement>("date-picker"),
  },
  () => toLocalIsoDate(new Date()),
);

elements.addButton.addEventListener("click", () => openForm(null));
elements.cancelButton.addEventListener("click", closeForm);
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveForm();
});

void start();

async function start(): Promise<void> {
  view.coupons = await loadCoupons();
  renderCoupons();
}

// ---------- Changing coupons ----------

async function saveForm(): Promise<void> {
  const validation = validateDraft(readDraft(elements.form));
  showFieldErrors(validation.ok ? {} : validation.errors);
  if (!validation.ok) return;

  const now = Date.now();
  const existing = findCoupon(view.editingId);
  const next = existing === undefined
    ? createCoupon(validation.fields, crypto.randomUUID(), now)
    : updateCoupon(existing, validation.fields, now);

  await commit(upsertCoupon(view.coupons, next));
  closeForm();
}

async function deleteCoupon(coupon: Coupon): Promise<void> {
  view.pendingDeleteId = null;
  await commit(upsertCoupon(view.coupons, markDeleted(coupon, Date.now())));
}

async function commit(coupons: Coupon[]): Promise<void> {
  await saveCoupons(coupons);
  view.coupons = coupons;
  renderCoupons();
}

// ---------- Form ----------

function openForm(coupon: Coupon | null): void {
  view.editingId = coupon?.id ?? null;
  expiryPicker.close();
  writeDraft(elements.form, coupon ?? { store: "", code: "", expiresOn: "", notes: "" });
  showFieldErrors({});
  elements.form.hidden = false;
  elements.addButton.hidden = true;
  elements.form.querySelector<HTMLInputElement>("input")?.focus();
}

function closeForm(): void {
  view.editingId = null;
  expiryPicker.close();
  elements.form.reset();
  elements.form.hidden = true;
  elements.addButton.hidden = false;
}

function readDraft(form: HTMLFormElement): CouponDraft {
  const data = new FormData(form);
  const text = (name: keyof CouponDraft) => String(data.get(name) ?? "");
  return { store: text("store"), code: text("code"), expiresOn: text("expiresOn"), notes: text("notes") };
}

function writeDraft(form: HTMLFormElement, draft: CouponDraft): void {
  for (const [name, value] of Object.entries(draft)) {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    if (field !== null) field.value = value;
  }
}

function showFieldErrors(errors: DraftErrors): void {
  for (const slot of elements.form.querySelectorAll<HTMLElement>("[data-error-for]")) {
    slot.textContent = errors[slot.dataset.errorFor as keyof DraftErrors] ?? "";
  }
}

// ---------- Rendering ----------

function renderCoupons(): void {
  const today = toLocalIsoDate(new Date());
  const { active, expired } = groupLiveCouponsByExpiry(view.coupons, today);

  elements.activeList.replaceChildren(...active.map((coupon) => renderCouponItem(coupon, today)));
  elements.expiredList.replaceChildren(...expired.map((coupon) => renderCouponItem(coupon, today)));
  elements.expiredSection.hidden = expired.length === 0;
  elements.emptyState.hidden = active.length + expired.length > 0;
}

// Built with createElement/textContent, never innerHTML: store names, codes
// and notes are user text and must not be interpreted as markup.
function renderCouponItem(coupon: Coupon, today: IsoDate): HTMLLIElement {
  const item = element("li", "coupon");

  const header = element("div", "coupon-header");
  header.append(element("span", "coupon-store", coupon.store), element("span", "coupon-expiry", describeExpiry(coupon.expiresOn, today)));

  const codeRow = element("div", "coupon-code-row");
  codeRow.append(element("code", "coupon-code", coupon.code), renderCopyButton(coupon.code));

  item.append(header, codeRow);
  if (coupon.notes !== "") item.append(element("p", "coupon-notes", coupon.notes));
  item.append(renderItemActions(coupon));
  return item;
}

function renderCopyButton(code: string): HTMLButtonElement {
  const button = element("button", "copy-button", "Copy");
  button.type = "button";
  button.addEventListener("click", () => void copyToClipboard(code, button));
  return button;
}

function renderItemActions(coupon: Coupon): HTMLDivElement {
  const actions = element("div", "coupon-actions");

  const edit = element("button", "link-button", "Edit");
  edit.type = "button";
  edit.addEventListener("click", () => openForm(coupon));

  // Two-step delete instead of window.confirm(), which extension popups don't reliably support.
  const awaitingConfirm = view.pendingDeleteId === coupon.id;
  const remove = element("button", awaitingConfirm ? "link-button danger" : "link-button", awaitingConfirm ? "Confirm delete" : "Delete");
  remove.type = "button";
  remove.addEventListener("click", () => {
    if (awaitingConfirm) {
      void deleteCoupon(coupon);
    } else {
      view.pendingDeleteId = coupon.id;
      renderCoupons();
    }
  });

  actions.append(edit, remove);
  return actions;
}

async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    flashLabel(button, "Copied");
  } catch {
    flashLabel(button, "Copy failed");
  }
}

function flashLabel(button: HTMLButtonElement, label: string): void {
  const original = button.textContent;
  button.textContent = label;
  setTimeout(() => (button.textContent = original), 1200);
}

// ---------- Small DOM helpers ----------

function findCoupon(id: string | null): Coupon | undefined {
  return id === null ? undefined : view.coupons.find((coupon) => coupon.id === id);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`popup.html is missing #${id}`);
  return node as T;
}
