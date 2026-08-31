import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/202608310001_contextlines_learning.sql",
    import.meta.url,
  ),
  "utf8",
);

const userId = "00000000-0000-4000-8000-000000000001";

interface IdRow {
  id: string;
}

async function insertExpression(db: PGlite, suffix = "") {
  const result = await db.query<IdRow>(
    `insert into public.saved_expressions (
      expression, source_transcript, meaning_zh, intent, usage_note,
      personal_example, meaning_classification, schema_version
    ) values ($1, $2, $3, $4, $5, $6, 'language_fact', 1)
    returning id`,
    [
      `keep the peace${suffix}`,
      `She was trying to keep the peace${suffix}.`,
      "维持和气",
      "避免冲突",
      "用于人际冲突场景。",
      `At work I try to keep the peace${suffix} during tense meetings.`,
    ],
  );
  return result.rows[0]!.id;
}

describe("ContextLines learning migration", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(`
      create schema auth;
      create role authenticated;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      insert into auth.users (id) values ('${userId}');
      select set_config('request.jwt.claim.sub', '${userId}', false);
    `);
    await db.exec(migration);
  });

  afterEach(async () => {
    await db.close();
  });

  it("atomically creates the three review card types", async () => {
    const expressionId = await insertExpression(db);
    const cards = await db.query<{ card_type: string }>(
      `select card_type from public.review_cards
       where saved_expression_id = $1 order by card_type`,
      [expressionId],
    );

    expect(cards.rows.map((row) => row.card_type)).toEqual([
      "english_to_meaning",
      "personal_cloze",
      "scene_to_english",
    ]);
  });

  it("rejects a missing or unusable personal example", async () => {
    await expect(
      db.query(
        `insert into public.saved_expressions (
          expression, source_transcript, meaning_zh, intent, usage_note,
          personal_example, meaning_classification, schema_version
        ) values ('keep the peace', 'source', 'meaning', 'intent', 'usage',
          'I avoided the argument.', 'language_fact', 1)`,
      ),
    ).rejects.toThrow();
  });

  it("records an FSRS transition with optimistic locking", async () => {
    const expressionId = await insertExpression(db, " now");
    const cards = await db.query<IdRow>(
      `select id from public.review_cards
       where saved_expression_id = $1 order by card_type limit 1`,
      [expressionId],
    );
    const cardId = cards.rows[0]!.id;
    const now = new Date("2026-08-31T12:00:00.000Z");
    const due = new Date("2026-09-01T12:00:00.000Z");
    const parameters = [
      cardId,
      0,
      3,
      due.toISOString(),
      1.2,
      5.5,
      0,
      1,
      0,
      1,
      0,
      1,
      now.toISOString(),
      JSON.stringify({ state: 0 }),
      JSON.stringify({ state: 1 }),
    ];

    const updated = await db.query<{ version: number; reps: number }>(
      `select version, reps from public.record_review(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )`,
      parameters,
    );
    expect(updated.rows[0]).toMatchObject({ version: 1, reps: 1 });

    const events = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.review_events where review_card_id = $1",
      [cardId],
    );
    expect(events.rows[0]?.count).toBe(1);

    await expect(
      db.query(
        `select * from public.record_review(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )`,
        parameters,
      ),
    ).rejects.toThrow(/version conflict/);
  });

  it("cascades expression deletion to cards and review events", async () => {
    const expressionId = await insertExpression(db, " again");
    await db.query("delete from public.saved_expressions where id = $1", [
      expressionId,
    ]);
    const cards = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.review_cards where saved_expression_id = $1",
      [expressionId],
    );
    expect(cards.rows[0]?.count).toBe(0);
  });
});
