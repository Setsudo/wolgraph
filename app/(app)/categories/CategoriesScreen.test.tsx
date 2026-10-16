import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewHarness } from "@/app/dev/categories-preview/PreviewHarness";
import type { ActionResult, CategoryActions } from "@/lib/data/categoryRules";
import { FIXTURE_CATEGORIES } from "@/app/dev/categories-preview/fakeCategories";
import { CategoriesScreen } from "./CategoriesScreen";

afterEach(cleanup);

function setup() {
  render(<PreviewHarness delayMs={0} />);
}

function rename(currentName: string, nextName: string) {
  fireEvent.click(screen.getByRole("button", { name: `Rename ${currentName}` }));
  const input = screen.getByRole("textbox", { name: `Rename ${currentName}` });
  fireEvent.change(input, { target: { value: nextName } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

function archivedSection() {
  return screen.getByText(/^Archived \(\d+\)$/).closest("details")!;
}

describe("CategoriesScreen", () => {
  it("lists active mains with their subs and an archived count", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Categories" })).toBeTruthy();
    expect(screen.getByText("Sleep")).toBeTruthy();
    expect(screen.getByText("Archived (2)")).toBeTruthy();
    expect(within(archivedSection()).getByText("Hobbies")).toBeTruthy();
    expect(within(archivedSection()).getByText("in Career")).toBeTruthy();
  });

  it("rejects an empty name", () => {
    setup();
    rename("Sleep", "   ");
    expect(screen.getByRole("alert").textContent).toBe("Enter a name.");
  });

  it("rejects a 41-character name and accepts 40", async () => {
    setup();
    rename("Sleep", "x".repeat(41));
    expect(screen.getByRole("alert").textContent).toBe("Use 40 characters or fewer.");
    const input = screen.getByRole("textbox", { name: "Rename Sleep" });
    fireEvent.change(input, { target: { value: "y".repeat(40) } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("y".repeat(40));
  });

  it("rejects a case-insensitive duplicate among active siblings", () => {
    setup();
    rename("Sleep", " exercise ");
    expect(screen.getByRole("alert").textContent).toBe("A category with this name already exists.");
    // Escape cancels
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Rename Sleep" }), { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Sleep")).toBeTruthy();
  });

  it("allows a name that only an archived sibling uses", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    const input = screen.getByRole("textbox", { name: "New category name" });
    fireEvent.change(input, { target: { value: "hobbies" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Archive hobbies" })).toBeTruthy();
  });

  it("allows a sub name that a different main's sub uses", async () => {
    setup();
    const career = screen.getByRole("button", { name: "Archive Career" }).closest("li")!;
    fireEvent.click(within(career).getByRole("button", { name: "+ Add subcategory" }));
    const input = screen.getByRole("textbox", { name: "New subcategory of Career" });
    fireEvent.change(input, { target: { value: "Sleep" } });
    fireEvent.click(within(career).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(within(career).getByText("Sleep")).toBeTruthy());
  });

  it("defaults the new category color to the first palette color unused by an active main", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    expect((screen.getByRole("radio", { name: "#2F8C8C" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Archive Finance" }));
    await screen.findByText("Archived Finance.");
    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    expect((screen.getByRole("radio", { name: "#3E8E4F" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
  });

  it("archiving a main archives its subs; restoring the main from Archived restores only the main", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Archive Health" }));
    await screen.findByText("Archived Health.");
    expect(screen.queryByRole("button", { name: "Archive Sleep" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive Exercise" })).toBeNull();
    expect(screen.getByText("Archived (5)")).toBeTruthy();
    expect(within(archivedSection()).getAllByText("in Health")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Restore Health" }));
    await screen.findByRole("button", { name: "Archive Health" });
    expect(screen.queryByRole("button", { name: "Archive Sleep" })).toBeNull();
    expect(screen.getByText("Archived (4)")).toBeTruthy();
  });

  it("undo reverses exactly what the archive did: main and the subs it archived", async () => {
    const initial = [
      ...FIXTURE_CATEGORIES,
      {
        ...FIXTURE_CATEGORIES.find((c) => c.id === "sleep")!,
        id: "naps",
        name: "Naps",
        sort_order: 2,
        archived_at: "2026-02-01T00:00:00.000Z",
      },
    ];
    render(<PreviewHarness initial={initial} delayMs={0} />);
    expect(screen.getByText("Archived (3)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Archive Health" }));
    await screen.findByText("Archived Health.");
    expect(screen.getByText("Archived (6)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByRole("button", { name: "Archive Exercise" });
    expect(screen.getByRole("button", { name: "Archive Health" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Sleep" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive Naps" })).toBeNull();
    expect(screen.getByRole("button", { name: "Restore Naps" })).toBeTruthy();
    expect(screen.getByText("Archived (3)")).toBeTruthy();
  });

  it("refuses to restore a sub whose main is archived", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Archive Career" }));
    await screen.findByText("Archived Career.");
    fireEvent.click(screen.getByRole("button", { name: "Restore Side project" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Restore Career first.");
    expect(screen.getByRole("button", { name: "Restore Side project" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restore Career" }));
    await screen.findByRole("button", { name: "Archive Career" });
    fireEvent.click(screen.getByRole("button", { name: "Restore Side project" }));
    await screen.findByRole("button", { name: "Archive Side project" });
  });

  it("hides the archive toast after 5 seconds", async () => {
    vi.useFakeTimers();
    try {
      setup();
      fireEvent.click(screen.getByRole("button", { name: "Archive Family" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("Archived Family.")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.queryByText("Archived Family.")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("disables the row's buttons while its action runs and shows server errors", async () => {
    let resolve!: (r: { ok: false; message: string }) => void;
    const actions: CategoryActions = {
      addMain: vi.fn(),
      addSub: vi.fn(),
      rename: vi.fn(() => new Promise<ActionResult>((r) => (resolve = r))),
      archive: vi.fn(),
      restore: vi.fn(),
    };
    render(<CategoriesScreen categories={FIXTURE_CATEGORIES} actions={actions} />);
    rename("Finance", "Money");
    expect(actions.rename).toHaveBeenCalledWith("finance", "Money");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ ok: false, message: "Something went wrong. Try again." }));
    expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Try again.");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe("CategoriesScreen subcategories", () => {
  const mainItem = (name: string) =>
    screen.getByRole("button", { name: `Archive ${name}` }).closest("li")!;
  const rowOf = (name: string) =>
    screen.getByRole("button", { name: `Archive ${name}` }).parentElement!;
  const dotColor = (row: HTMLElement) =>
    (row.querySelector("span[aria-hidden]") as HTMLElement).style.backgroundColor;

  function addSub(main: string, name: string) {
    const item = mainItem(main);
    fireEvent.click(within(item).getByRole("button", { name: "+ Add subcategory" }));
    fireEvent.change(screen.getByRole("textbox", { name: `New subcategory of ${main}` }), {
      target: { value: name },
    });
    fireEvent.click(within(item).getByRole("button", { name: "Add" }));
  }

  it("adds a sub under its main in the main's color, renames, archives and restores it", async () => {
    setup();
    addSub("Career", "  Deep work ");
    await screen.findByRole("button", { name: "Archive Deep work" });
    expect(mainItem("Career").contains(rowOf("Deep work"))).toBe(true);
    expect(dotColor(rowOf("Deep work"))).toBe(dotColor(rowOf("Career")));
    expect(dotColor(rowOf("Deep work"))).toBe("rgb(200, 85, 61)"); // #C8553D

    rename("Deep work", "Focus");
    await screen.findByRole("button", { name: "Archive Focus" });
    expect(screen.queryByText("Deep work")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Archive Focus" }));
    await screen.findByText("Archived Focus.");
    expect(screen.queryByRole("button", { name: "Archive Focus" })).toBeNull();
    expect(screen.getByText("Archived (3)")).toBeTruthy();
    expect(within(archivedSection()).getByText("Focus")).toBeTruthy();
    expect(within(archivedSection()).getAllByText("in Career")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Restore Focus" }));
    await screen.findByRole("button", { name: "Archive Focus" });
    expect(mainItem("Career").contains(rowOf("Focus"))).toBe(true);
    expect(screen.getByText("Archived (2)")).toBeTruthy();
  });

  it("rejects a case-insensitive duplicate of an active sibling when adding a sub", () => {
    setup();
    addSub("Health", " SLEEP ");
    expect(screen.getByRole("alert").textContent).toBe("A category with this name already exists.");
    expect(within(mainItem("Health")).getAllByText(/sleep/i)).toHaveLength(1);
  });

  it("allows a sub named like an archived sibling", async () => {
    setup();
    addSub("Career", "side PROJECT");
    await screen.findByRole("button", { name: "Archive side PROJECT" });
    expect(within(archivedSection()).getByText("Side project")).toBeTruthy();
  });
});
