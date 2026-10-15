"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  bySortOrder,
  defaultMainColor,
  GENERIC_ERROR_MESSAGE,
  PALETTE,
  validateCategoryName,
  type ActionResult,
  type ArchiveResult,
  type Category,
  type CategoryActions,
} from "@/lib/data/categoryRules";

const TOAST_MS = 5000;

const textButton = "min-h-11 shrink-0 px-2 text-sm disabled:opacity-50";
const navyButton = `${textButton} text-navy/70`;
const tealButton = `${textButton} text-teal`;
const inputClass =
  "min-h-11 min-w-0 flex-1 rounded-lg border border-navy/20 bg-white px-3 text-base text-navy focus:border-teal focus:outline-none";

export function CategoriesHeading() {
  return <h1 className="font-display text-[28px] text-navy">Categories</h1>;
}

type Editor =
  | { kind: "rename"; id: string; value: string; error: string | null }
  | { kind: "addSub"; parentId: string; value: string; error: string | null }
  | { kind: "addMain"; value: string; color: string; error: string | null };

/** archivedIds: what the archive action archived, the category first; Undo restores exactly these. */
type Toast = { id: string; name: string; archivedIds: string[] };

export function CategoriesScreen({
  categories,
  actions,
}: {
  categories: Category[];
  actions: CategoryActions;
}) {
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const active = categories.filter((c) => c.archived_at === null);
  const mains = active.filter((c) => c.parent_id === null).sort(bySortOrder);
  const subsOf = (mainId: string) => active.filter((c) => c.parent_id === mainId).sort(bySortOrder);
  const byId = new Map(categories.map((c) => [c.id, c]));

  async function run<R extends ActionResult | ArchiveResult>(
    key: string,
    action: () => Promise<R>,
  ): Promise<R | { ok: false; message: string }> {
    setBusy((prev) => new Set(prev).add(key));
    try {
      return await action();
    } catch {
      return { ok: false, message: GENERIC_ERROR_MESSAGE };
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function setRowError(id: string, message: string | null) {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function submitEditor() {
    if (!editor) return;
    const current = editor;
    let key: string;
    let error: string | null;
    let action: () => Promise<ActionResult>;
    if (current.kind === "rename") {
      const category = byId.get(current.id);
      if (!category) return;
      key = current.id;
      error = validateCategoryName(categories, category.parent_id, current.value, current.id);
      action = () => actions.rename(current.id, current.value.trim());
    } else if (current.kind === "addSub") {
      key = `add-sub:${current.parentId}`;
      error = validateCategoryName(categories, current.parentId, current.value);
      action = () => actions.addSub(current.parentId, current.value.trim());
    } else {
      key = "add-main";
      error = validateCategoryName(categories, null, current.value);
      action = () => actions.addMain(current.value.trim(), current.color);
    }
    if (error) {
      setEditor({ ...current, error });
      return;
    }
    const result = await run(key, action);
    if (result.ok) setEditor((prev) => (sameEditor(prev, current) ? null : prev));
    else
      setEditor((prev) => (sameEditor(prev, current) ? { ...prev!, error: result.message } : prev));
  }

  async function archive(category: Category) {
    setRowError(category.id, null);
    const result = await run(category.id, () => actions.archive(category.id));
    if (result.ok) {
      setToast({ id: category.id, name: category.name, archivedIds: result.archivedIds });
      setEditor((prev) =>
        prev &&
        "id" in prev &&
        (prev.id === category.id || byId.get(prev.id)?.parent_id === category.id)
          ? null
          : prev,
      );
    } else {
      setRowError(category.id, result.message);
    }
  }

  async function restore(id: string) {
    setRowError(id, null);
    const result = await run(id, () => actions.restore(id));
    if (!result.ok) setRowError(id, result.message);
  }

  /** Reverses one archive: the category first, then the subs that archive took with it. */
  async function undo(current: Toast) {
    setToast(null);
    for (const id of current.archivedIds) {
      setRowError(id, null);
      const result = await run(id, () => actions.restore(id));
      if (!result.ok) {
        setRowError(id, result.message);
        if (id === current.id) return;
      }
    }
  }

  const archived = archivedList(categories);
  const addMainBusy = busy.has("add-main");

  return (
    // pb-24 keeps the last row clear of the fixed undo toast.
    <div className="mx-auto w-full max-w-[640px] pb-24">
      <CategoriesHeading />

      <ul className="mt-4 flex flex-col gap-3">
        {mains.map((main) => {
          const subs = subsOf(main.id);
          const addSubKey = `add-sub:${main.id}`;
          const addingSub =
            editor?.kind === "addSub" && editor.parentId === main.id ? editor : null;
          return (
            <li key={main.id} className="rounded-xl border border-navy/10 bg-white/60 p-4">
              <CategoryLine
                category={main}
                color={main.color}
                isSub={false}
                editor={editor}
                busy={busy.has(main.id)}
                error={rowErrors[main.id]}
                onEditorChange={setEditor}
                onSubmit={submitEditor}
                onArchive={() => archive(main)}
              />
              {subs.length > 0 && (
                <ul className="pl-6">
                  {subs.map((sub) => (
                    <li key={sub.id}>
                      <CategoryLine
                        category={sub}
                        color={main.color}
                        isSub
                        editor={editor}
                        busy={busy.has(sub.id)}
                        error={rowErrors[sub.id]}
                        onEditorChange={setEditor}
                        onSubmit={submitEditor}
                        onArchive={() => archive(sub)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="pl-6">
                {addingSub ? (
                  <NameForm
                    label={`New subcategory of ${main.name}`}
                    value={addingSub.value}
                    error={addingSub.error}
                    busy={busy.has(addSubKey)}
                    submitLabel="Add"
                    onChange={(value) => setEditor({ ...addingSub, value, error: null })}
                    onSubmit={submitEditor}
                    onCancel={() => setEditor(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className={tealButton}
                    onClick={() =>
                      setEditor({ kind: "addSub", parentId: main.id, value: "", error: null })
                    }
                  >
                    + Add subcategory
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        {editor?.kind === "addMain" ? (
          <NameForm
            label="New category name"
            value={editor.value}
            error={editor.error}
            busy={addMainBusy}
            submitLabel="Add"
            onChange={(value) => setEditor({ ...editor, value, error: null })}
            onSubmit={submitEditor}
            onCancel={() => setEditor(null)}
          >
            <div role="radiogroup" aria-label="Color" className="flex w-full flex-wrap">
              {PALETTE.map((hex) => (
                <label
                  key={hex}
                  className="flex size-11 cursor-pointer items-center justify-center"
                >
                  <input
                    type="radio"
                    name="category-color"
                    value={hex}
                    aria-label={hex}
                    checked={editor.color === hex}
                    disabled={addMainBusy}
                    onChange={() => setEditor({ ...editor, color: hex })}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="size-7 rounded-full ring-offset-2 ring-offset-cream peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-teal"
                    style={{ backgroundColor: hex }}
                  />
                </label>
              ))}
            </div>
          </NameForm>
        ) : (
          <button
            type="button"
            className={tealButton}
            onClick={() =>
              setEditor({
                kind: "addMain",
                value: "",
                color: defaultMainColor(categories),
                error: null,
              })
            }
          >
            + Add category
          </button>
        )}
      </div>

      <details className="mt-6">
        <summary className="min-h-11 cursor-pointer py-3 text-navy/70">
          Archived ({archived.length})
        </summary>
        <ul className="flex flex-col">
          {archived.map(({ category, main }) => (
            <li key={category.id}>
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-navy">
                  {category.name}
                  {main && <span className="text-navy/60"> in {main.name}</span>}
                </span>
                <button
                  type="button"
                  className={tealButton}
                  aria-label={`Restore ${category.name}`}
                  disabled={busy.has(category.id)}
                  onClick={() => restore(category.id)}
                >
                  Restore
                </button>
              </div>
              {rowErrors[category.id] && <ErrorText>{rowErrors[category.id]}</ErrorText>}
            </li>
          ))}
        </ul>
      </details>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-navy py-1 pr-2 pl-5 text-cream"
        >
          <span className="truncate">Archived {toast.name}.</span>
          <button
            type="button"
            className="min-h-11 shrink-0 px-2 text-teal-200"
            onClick={() => undo(toast)}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function sameEditor(a: Editor | null, b: Editor): a is Editor {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "rename" && b.kind === "rename") return a.id === b.id;
  if (a.kind === "addSub" && b.kind === "addSub") return a.parentId === b.parentId;
  return true;
}

/** Archived mains, then archived subs (with their main), each in sort order. */
export function archivedList(
  categories: Category[],
): { category: Category; main: Category | null }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const archived = categories.filter((c) => c.archived_at !== null);
  const mains = archived.filter((c) => c.parent_id === null).sort(bySortOrder);
  const subs = archived
    .filter((c) => c.parent_id !== null)
    .map((c) => ({ category: c, main: byId.get(c.parent_id!) ?? null }))
    .sort(
      (a, b) =>
        (a.main?.sort_order ?? 0) - (b.main?.sort_order ?? 0) ||
        bySortOrder(a.category, b.category),
    );
  return [...mains.map((category) => ({ category, main: null })), ...subs];
}

function CategoryLine({
  category,
  color,
  isSub,
  editor,
  busy,
  error,
  onEditorChange,
  onSubmit,
  onArchive,
}: {
  category: Category;
  color: string;
  isSub: boolean;
  editor: Editor | null;
  busy: boolean;
  error: string | undefined;
  onEditorChange: (editor: Editor | null) => void;
  onSubmit: () => void;
  onArchive: () => void;
}) {
  const renaming = editor?.kind === "rename" && editor.id === category.id ? editor : null;
  const dot = (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full ${isSub ? "size-2" : "size-3.5"}`}
      style={{ backgroundColor: color }}
    />
  );

  if (renaming) {
    return (
      <NameForm
        label={`Rename ${category.name}`}
        value={renaming.value}
        error={renaming.error}
        busy={busy}
        submitLabel="Save"
        leading={dot}
        onChange={(value) => onEditorChange({ ...renaming, value, error: null })}
        onSubmit={onSubmit}
        onCancel={() => onEditorChange(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {dot}
        <span
          className={`min-w-0 flex-1 truncate text-navy ${isSub ? "text-[15px]" : "text-base"}`}
        >
          {category.name}
        </span>
        <button
          type="button"
          className={navyButton}
          aria-label={`Rename ${category.name}`}
          disabled={busy}
          onClick={() =>
            onEditorChange({ kind: "rename", id: category.id, value: category.name, error: null })
          }
        >
          Rename
        </button>
        <button
          type="button"
          className={navyButton}
          aria-label={`Archive ${category.name}`}
          disabled={busy}
          onClick={onArchive}
        >
          Archive
        </button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function NameForm({
  label,
  value,
  error,
  busy,
  submitLabel,
  leading,
  children,
  onChange,
  onSubmit,
  onCancel,
}: {
  label: string;
  value: string;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  leading?: ReactNode;
  children?: ReactNode;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onSubmit();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }
  const errorId = `${label.replace(/\W+/g, "-")}-error`;

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center gap-3">
        {leading}
        <input
          type="text"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          disabled={busy}
          // Opened by an explicit tap on Rename / Add; focus follows the user's intent.
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClass}
        />
        {children}
        <div className="flex">
          <button type="submit" className={tealButton} disabled={busy}>
            {submitLabel}
          </button>
          <button type="button" className={navyButton} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </form>
  );
}

function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1 text-[13px] text-amber">
      {children}
    </p>
  );
}
