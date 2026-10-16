import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Runs supabase/migrations against PGlite with a stub `auth` schema
// (supabase/test/auth_stub.sql). Setup runs as the PGlite superuser, which
// bypasses RLS; RLS checks switch to the `authenticated` / `anon` roles.

const root = fileURLToPath(new URL("../../", import.meta.url));
const migrationsDir = `${root}supabase/migrations/`;

const USER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const USER_B = "bbbbbbbb-0000-4000-8000-000000000002";

const SEEDED = [
  ["Health", "#2F8C8C"],
  ["Personal Growth", "#5B6CC0"],
  ["Finance", "#3E8E4F"],
  ["Family", "#C9831F"],
  ["Career", "#C8553D"],
  ["Relaxation", "#7A5BA8"],
  ["Relationships", "#C2557F"],
  ["Spirituality", "#4F7C9E"],
] as const;

let db: PGlite;

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function affected(sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query(sql, params)).affectedRows ?? 0;
}

async function asRole(role: "authenticated" | "anon", sub: string | null) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? ""]);
}

async function asSuperuser() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

async function mainId(userId: string, name: string): Promise<string> {
  const [row] = await rows<{ id: string }>(
    "select id from categories where user_id = $1 and parent_id is null and name = $2",
    [userId, name],
  );
  return row.id;
}

async function addCategory(
  userId: string,
  name: string,
  parentId: string | null = null,
  color = "#2F8C8C",
): Promise<string> {
  const [row] = await rows<{ id: string }>(
    `insert into categories (user_id, parent_id, name, color, sort_order)
     values ($1, $2, $3, $4, 99) returning id`,
    [userId, parentId, name, color],
  );
  return row.id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(`${root}supabase/test/auth_stub.sql`, "utf8"));
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(migrationsDir + file, "utf8"));
  }
  await db.query(
    "insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com')",
    [USER_A, USER_B],
  );
});

afterEach(asSuperuser);

afterAll(async () => {
  await db?.close();
});

describe("seed_default_categories", () => {
  it("creates the 8 default main categories with names, order and colors on user insert", async () => {
    const seeded = await rows<{
      name: string;
      color: string;
      sort_order: number;
      parent_id: string | null;
    }>(
      "select name, color, sort_order, parent_id from categories where user_id = $1 order by sort_order",
      [USER_A],
    );
    expect(seeded).toEqual(
      SEEDED.map(([name, color], i) => ({ name, color, sort_order: i, parent_id: null })),
    );
  });

  it("is idempotent", async () => {
    const count = async () =>
      (
        await rows<{ n: number }>("select count(*)::int as n from categories where user_id = $1", [
          USER_A,
        ])
      )[0].n;
    expect(await count()).toBe(8);
    await db.query("select public.seed_default_categories($1)", [USER_A]);
    await db.query("select public.seed_default_categories($1)", [USER_A]);
    expect(await count()).toBe(8);
  });

  it("is not executable by authenticated users", async () => {
    await asRole("authenticated", USER_A);
    await expect(
      db.query("select public.seed_default_categories($1)", [USER_A]),
    ).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("entries.hours check", () => {
  const insertHours = async (day: string, hours: string) =>
    db.query("insert into entries (user_id, category_id, day, hours) values ($1, $2, $3, $4)", [
      USER_A,
      await mainId(USER_A, "Finance"),
      day,
      hours,
    ]);

  it("rejects 0.1 and 25", async () => {
    await expect(insertHours("2026-01-01", "0.1")).rejects.toMatchObject({ code: "23514" });
    await expect(insertHours("2026-01-02", "25")).rejects.toMatchObject({ code: "23514" });
  });

  it("accepts 0.25 and 24", async () => {
    await insertHours("2026-01-03", "0.25");
    await insertHours("2026-01-04", "24");
    const got = await rows<{ hours: string }>(
      "select hours::text as hours from entries where user_id = $1 and day in ('2026-01-03', '2026-01-04') order by day",
      [USER_A],
    );
    expect(got.map((r) => r.hours)).toEqual(["0.25", "24.00"]);
  });

  it("maintains updated_at on update", async () => {
    const career = await mainId(USER_A, "Career");
    await db.query(
      "insert into entries (user_id, category_id, day, hours, updated_at) values ($1, $2, '2026-01-05', 1, '2000-01-01')",
      [USER_A, career],
    );
    await db.query(
      "update entries set hours = 2 where user_id = $1 and category_id = $2 and day = '2026-01-05'",
      [USER_A, career],
    );
    const [{ stale }] = await rows<{ stale: boolean }>(
      "select updated_at < '2001-01-01' as stale from entries where user_id = $1 and category_id = $2 and day = '2026-01-05'",
      [USER_A, career],
    );
    expect(stale).toBe(false);
  });
});

describe("category hierarchy", () => {
  it("accepts a sub of a main and stores the parent's color", async () => {
    const health = await mainId(USER_A, "Health");
    const sub = await addCategory(USER_A, "Exercise", health, "#000000");
    const [{ color }] = await rows<{ color: string }>(
      "select color from categories where id = $1",
      [sub],
    );
    expect(color).toBe("#2F8C8C");
  });

  it("propagates a main's color change to its subs", async () => {
    const main = await addCategory(USER_A, "Hobbies", null, "#5B6CC0");
    const sub = await addCategory(USER_A, "Painting", main);
    await db.query("update categories set color = '#C8553D' where id = $1", [main]);
    const [{ color }] = await rows<{ color: string }>(
      "select color from categories where id = $1",
      [sub],
    );
    expect(color).toBe("#C8553D");
  });

  it("rejects a sub of a sub", async () => {
    const family = await mainId(USER_A, "Family");
    const sub = await addCategory(USER_A, "Kids", family);
    await expect(addCategory(USER_A, "Homework", sub)).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects turning a main with subs into a sub, and self-parenting", async () => {
    const main = await addCategory(USER_A, "Projects", null);
    await addCategory(USER_A, "Garden", main);
    const otherMain = await mainId(USER_A, "Career");
    await expect(
      db.query("update categories set parent_id = $1 where id = $2", [otherMain, main]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query("update categories set parent_id = id where id = $1", [otherMain]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects a parent that belongs to another user", async () => {
    const parentOfB = await mainId(USER_B, "Health");
    await expect(addCategory(USER_A, "Running", parentOfB)).rejects.toThrow(/another user/);
  });

  it("rejects an invalid main color", async () => {
    await expect(addCategory(USER_A, "Bad color", null, "teal")).rejects.toMatchObject({
      code: "23514",
    });
    await expect(addCategory(USER_A, "Bad color", null, "#2F8C8")).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects names that are blank or longer than 40 characters", async () => {
    await expect(addCategory(USER_A, "   ")).rejects.toMatchObject({ code: "23514" });
    await expect(addCategory(USER_A, "x".repeat(41))).rejects.toMatchObject({ code: "23514" });
  });
});

describe("entries.category ownership", () => {
  it("rejects an entry on another user's category", async () => {
    const categoryOfB = await mainId(USER_B, "Career");
    await expect(
      db.query(
        "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-02-01', 1)",
        [USER_A, categoryOfB],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});

describe("active sibling name uniqueness", () => {
  it("rejects a case-insensitive duplicate active sibling, allows it after archiving the first", async () => {
    const health = await mainId(USER_A, "Health");
    const first = await addCategory(USER_A, "Sleep", health);
    await expect(addCategory(USER_A, "SLEEP", health)).rejects.toMatchObject({ code: "23505" });
    await expect(addCategory(USER_A, "health")).rejects.toMatchObject({ code: "23505" });

    await db.query("update categories set archived_at = now() where id = $1", [first]);
    await expect(addCategory(USER_A, "SLEEP", health)).resolves.toBeTypeOf("string");
  });

  it("allows the same name under different parents and for different users", async () => {
    await addCategory(USER_A, "Reading", await mainId(USER_A, "Relaxation"));
    await addCategory(USER_A, "Reading", await mainId(USER_A, "Personal Growth"));
    await addCategory(USER_B, "Reading", await mainId(USER_B, "Relaxation"));
  });
});

describe("subcategories end to end", () => {
  // A fresh main per test keeps names clear of the other blocks' rows.
  let n = 0;
  const freshMain = async (color = "#7A5BA8") => addCategory(USER_A, `Studio ${++n}`, null, color);
  const colorOf = async (id: string) =>
    (await rows<{ color: string }>("select color from categories where id = $1", [id]))[0].color;
  const archive = (id: string) =>
    db.query("update categories set archived_at = now() where id = $1", [id]);
  const restore = (id: string) =>
    db.query("update categories set archived_at = null where id = $1", [id]);

  it("a sub always holds its main's color, whatever is written to it", async () => {
    const main = await freshMain("#7A5BA8");
    const sub = await addCategory(USER_A, "Pottery", main, "#000000");
    expect(await colorOf(sub)).toBe("#7A5BA8");
    await db.query("update categories set color = '#111111' where id = $1", [sub]);
    expect(await colorOf(sub)).toBe("#7A5BA8");
    await db.query("update categories set name = 'Ceramics' where id = $1", [sub]);
    expect(await colorOf(sub)).toBe("#7A5BA8");
  });

  it("rename keeps the id; active sibling names stay unique case-insensitively on rename and restore", async () => {
    const main = await freshMain();
    const pottery = await addCategory(USER_A, "Pottery", main);
    const glaze = await addCategory(USER_A, "Glaze", main);
    await db.query("update categories set name = 'Ceramics' where id = $1", [pottery]);
    expect(
      (await rows<{ name: string }>("select name from categories where id = $1", [pottery]))[0]
        .name,
    ).toBe("Ceramics");
    await expect(
      db.query("update categories set name = 'CERAMICS' where id = $1", [glaze]),
    ).rejects.toMatchObject({ code: "23505" });

    // Archive, then restore: the name is free while archived, taken again on restore.
    await archive(pottery);
    const newer = await addCategory(USER_A, "ceramics", main);
    await expect(restore(pottery)).rejects.toMatchObject({ code: "23505" });
    await archive(newer);
    await restore(pottery);
    const [{ archived }] = await rows<{ archived: boolean }>(
      "select archived_at is not null as archived from categories where id = $1",
      [pottery],
    );
    expect(archived).toBe(false);
  });

  it("hours on a sub and on its main the same day are separate rows; archiving keeps them", async () => {
    const main = await freshMain();
    const sub = await addCategory(USER_A, "Wheel throwing", main);
    const insert = (categoryId: string, hours: number) =>
      db.query(
        "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-07-01', $3)",
        [USER_A, categoryId, hours],
      );
    await insert(main, 1.5);
    await insert(sub, 2.25);
    await archive(sub);
    // The main's day total per SPEC §5: its own entry + its subs' entries (archived subs too).
    const [{ total }] = await rows<{ total: string }>(
      `select sum(e.hours)::text as total
         from entries e join categories c on c.id = e.category_id
        where e.user_id = $1 and e.day = '2026-07-01' and coalesce(c.parent_id, c.id) = $2`,
      [USER_A, main],
    );
    expect(total).toBe("3.75");
  });

  it("archiving a main does not cascade in the database (the archive action archives its subs)", async () => {
    const main = await freshMain();
    const sub = await addCategory(USER_A, "Kiln", main);
    await archive(main);
    const [{ archived }] = await rows<{ archived: boolean }>(
      "select archived_at is not null as archived from categories where id = $1",
      [sub],
    );
    expect(archived).toBe(false);
  });
});

describe("row-level security", () => {
  let catA: string;

  beforeAll(async () => {
    catA = await mainId(USER_A, "Spirituality");
    await db.query(
      "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-03-01', 2)",
      [USER_A, catA],
    );
  });

  it("user A sees only their own rows", async () => {
    await asRole("authenticated", USER_A);
    const cats = await rows<{ user_id: string }>("select user_id from categories");
    const ents = await rows<{ user_id: string }>("select user_id from entries");
    expect(cats.length).toBeGreaterThanOrEqual(8);
    expect(ents.length).toBeGreaterThan(0);
    expect(new Set([...cats, ...ents].map((r) => r.user_id))).toEqual(new Set([USER_A]));
  });

  it("user B cannot select user A's categories or entries", async () => {
    await asRole("authenticated", USER_B);
    expect(await rows("select 1 from categories where user_id = $1", [USER_A])).toHaveLength(0);
    expect(await rows("select 1 from entries where user_id = $1", [USER_A])).toHaveLength(0);
  });

  it("user B cannot insert categories or entries with user_id A", async () => {
    await asRole("authenticated", USER_B);
    await expect(addCategory(USER_A, "Intruder")).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-03-02', 1)",
        [USER_A, catA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("user B cannot update user A's categories or entries", async () => {
    await asRole("authenticated", USER_B);
    expect(await affected("update categories set name = 'Hacked' where id = $1", [catA])).toBe(0);
    expect(await affected("update entries set hours = 5 where user_id = $1", [USER_A])).toBe(0);
    // Nor reassign their own rows to user A.
    const catB = await mainId(USER_B, "Spirituality");
    await expect(
      db.query("update categories set user_id = $1 where id = $2", [USER_A, catB]),
    ).rejects.toMatchObject({ code: "42501" });

    await asSuperuser();
    const [{ name }] = await rows<{ name: string }>("select name from categories where id = $1", [
      catA,
    ]);
    const [{ hours }] = await rows<{ hours: string }>(
      "select hours::text as hours from entries where user_id = $1 and category_id = $2 and day = '2026-03-01'",
      [USER_A, catA],
    );
    expect(name).toBe("Spirituality");
    expect(hours).toBe("2.00");
  });

  it("user B cannot delete user A's categories or entries", async () => {
    await asRole("authenticated", USER_B);
    expect(await affected("delete from entries where user_id = $1", [USER_A])).toBe(0);
    expect(await affected("delete from categories where user_id = $1", [USER_A])).toBe(0);

    await asSuperuser();
    const [{ cats }] = await rows<{ cats: number }>(
      "select count(*)::int as cats from categories where user_id = $1",
      [USER_A],
    );
    const [{ ents }] = await rows<{ ents: number }>(
      "select count(*)::int as ents from entries where user_id = $1",
      [USER_A],
    );
    expect(cats).toBeGreaterThanOrEqual(8);
    expect(ents).toBeGreaterThan(0);
  });

  it("user A can insert, update and delete their own entry", async () => {
    await asRole("authenticated", USER_A);
    await db.query(
      "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-03-03', 1.5)",
      [USER_A, catA],
    );
    expect(
      await affected("update entries set hours = 2.75 where user_id = $1 and day = '2026-03-03'", [
        USER_A,
      ]),
    ).toBe(1);
    expect(
      await affected("delete from entries where user_id = $1 and day = '2026-03-03'", [USER_A]),
    ).toBe(1);
  });

  it("anon role sees nothing and cannot write", async () => {
    await asRole("anon", null);
    await expect(db.query("select 1 from categories")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select 1 from entries")).rejects.toMatchObject({ code: "42501" });
    await expect(addCategory(USER_A, "Anon")).rejects.toMatchObject({ code: "42501" });
  });
});

describe("ratings", () => {
  const insertRating = (userId: string, categoryId: string, day: string, score: number) =>
    db.query("insert into ratings (user_id, category_id, day, score) values ($1, $2, $3, $4)", [
      userId,
      categoryId,
      day,
      score,
    ]);

  it("accepts 0 and 10, rejects 11 and -1", async () => {
    const health = await mainId(USER_A, "Health");
    await insertRating(USER_A, health, "2026-05-01", 0);
    await insertRating(USER_A, health, "2026-05-02", 10);
    await expect(insertRating(USER_A, health, "2026-05-03", 11)).rejects.toMatchObject({
      code: "23514",
    });
    await expect(insertRating(USER_A, health, "2026-05-04", -1)).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("rejects a sub-category, on insert and on update", async () => {
    const career = await mainId(USER_A, "Career");
    const sub = await addCategory(USER_A, "Side project", career);
    await expect(insertRating(USER_A, sub, "2026-05-01", 5)).rejects.toMatchObject({
      code: "23514",
    });
    await insertRating(USER_A, career, "2026-05-01", 5);
    await expect(
      db.query(
        "update ratings set category_id = $1 where user_id = $2 and category_id = $3 and day = '2026-05-01'",
        [sub, USER_A, career],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects a rating on another user's category", async () => {
    await expect(
      insertRating(USER_A, await mainId(USER_B, "Finance"), "2026-05-01", 5),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("allows one score per category and day", async () => {
    const finance = await mainId(USER_A, "Finance");
    await insertRating(USER_A, finance, "2026-05-01", 4);
    await expect(insertRating(USER_A, finance, "2026-05-01", 6)).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("maintains updated_at on update", async () => {
    const family = await mainId(USER_A, "Family");
    await db.query(
      "insert into ratings (user_id, category_id, day, score, updated_at) values ($1, $2, '2026-05-01', 3, '2000-01-01')",
      [USER_A, family],
    );
    await db.query(
      "update ratings set score = 4 where user_id = $1 and category_id = $2 and day = '2026-05-01'",
      [USER_A, family],
    );
    const [{ stale }] = await rows<{ stale: boolean }>(
      "select updated_at < '2001-01-01' as stale from ratings where user_id = $1 and category_id = $2 and day = '2026-05-01'",
      [USER_A, family],
    );
    expect(stale).toBe(false);
  });

  describe("row-level security", () => {
    const DAY = "2026-06-01";
    let relA: string;
    let relB: string;

    beforeAll(async () => {
      relA = await mainId(USER_A, "Relationships");
      relB = await mainId(USER_B, "Relationships");
      await insertRating(USER_A, relA, DAY, 7);
      await insertRating(USER_B, relB, DAY, 2);
    });

    async function scoreOfA(): Promise<number | undefined> {
      await asSuperuser();
      const [row] = await rows<{ score: number }>(
        "select score from ratings where user_id = $1 and category_id = $2 and day = $3",
        [USER_A, relA, DAY],
      );
      return row?.score;
    }

    it("select: each user sees only their own ratings", async () => {
      await asRole("authenticated", USER_A);
      const seenByA = await rows<{ user_id: string }>("select user_id from ratings");
      expect(seenByA.length).toBeGreaterThan(0);
      expect(new Set(seenByA.map((r) => r.user_id))).toEqual(new Set([USER_A]));
      await asRole("authenticated", USER_B);
      expect(await rows("select 1 from ratings where user_id = $1", [USER_A])).toHaveLength(0);
      expect(await rows("select 1 from ratings where user_id = $1", [USER_B])).toHaveLength(1);
    });

    it("insert: user B cannot insert a rating as user A", async () => {
      await asRole("authenticated", USER_B);
      await expect(insertRating(USER_A, relA, "2026-06-02", 5)).rejects.toMatchObject({
        code: "42501",
      });
    });

    it("update: user B cannot change user A's rating, nor hand their own to A", async () => {
      await asRole("authenticated", USER_B);
      expect(await affected("update ratings set score = 0 where user_id = $1", [USER_A])).toBe(0);
      await expect(
        db.query("update ratings set user_id = $1 where user_id = $2", [USER_A, USER_B]),
      ).rejects.toMatchObject({ code: "42501" });
      expect(await scoreOfA()).toBe(7);
    });

    it("delete: user B cannot delete user A's rating", async () => {
      await asRole("authenticated", USER_B);
      expect(await affected("delete from ratings where user_id = $1", [USER_A])).toBe(0);
      expect(await scoreOfA()).toBe(7);
    });

    it("user A can insert, update and delete their own rating", async () => {
      await asRole("authenticated", USER_A);
      await insertRating(USER_A, relA, "2026-06-03", 6);
      const where = "where user_id = $1 and category_id = $2 and day = '2026-06-03'";
      expect(await affected(`update ratings set score = 9 ${where}`, [USER_A, relA])).toBe(1);
      expect(await affected(`delete from ratings ${where}`, [USER_A, relA])).toBe(1);
    });

    it("anon cannot read or write ratings", async () => {
      await asRole("anon", null);
      await expect(db.query("select 1 from ratings")).rejects.toMatchObject({ code: "42501" });
      await expect(insertRating(USER_A, relA, "2026-06-04", 5)).rejects.toMatchObject({
        code: "42501",
      });
    });
  });
});

describe("user deletion", () => {
  it("cascades to the user's categories, entries and ratings", async () => {
    const userC = "cccccccc-0000-4000-8000-000000000003";
    await db.query("insert into auth.users (id) values ($1)", [userC]);
    const health = await mainId(userC, "Health");
    const sub = await addCategory(userC, "Walks", health);
    await db.query(
      "insert into entries (user_id, category_id, day, hours) values ($1, $2, '2026-04-01', 1)",
      [userC, sub],
    );
    await db.query(
      "insert into ratings (user_id, category_id, day, score) values ($1, $2, '2026-04-01', 6)",
      [userC, health],
    );
    await db.query("delete from auth.users where id = $1", [userC]);
    const [{ n }] = await rows<{ n: number }>(
      "select (select count(*) from categories where user_id = $1) + (select count(*) from entries where user_id = $1) + (select count(*) from ratings where user_id = $1) as n",
      [userC],
    );
    expect(Number(n)).toBe(0);
  });
});
