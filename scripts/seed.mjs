import "dotenv/config";
import { Pool } from "pg";

const { specialties, articles, faqs } = await import("../src/lib/site.ts");

const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const pool = new Pool({ connectionString });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    await client.query("truncate table specialties restart identity");
    await client.query("truncate table articles restart identity");
    await client.query("truncate table faqs restart identity");
    await client.query("truncate table testimonials restart identity");
    await client.query("truncate table case_studies restart identity");

    for (const [index, item] of specialties.entries()) {
      await client.query(
        `insert into specialties (slug, name, group_name, icon, blurb, focus, metric_value, metric_label, sort_order)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
        [item.slug, item.name, item.group, item.icon, item.blurb, JSON.stringify(item.focus), "99.9%", "Claim acceptance", index],
      );
    }

    for (const item of articles) {
      await client.query(
        `insert into articles (slug, title, category, excerpt, image, read_time, published_at, author, body, published)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,true)`,
        [item.slug, item.title, item.category, item.excerpt, item.image, item.readTime, item.date, item.author, JSON.stringify(item.body)],
      );
    }

    for (const [index, item] of faqs.entries()) {
      await client.query(`insert into faqs (question, answer, category, sort_order) values ($1,$2,'general',$3)`, [item.q, item.a, index]);
    }

    await client.query("commit");
    console.log(`Seeded ${specialties.length} specialties, ${articles.length} articles, ${faqs.length} FAQs.`);
  } catch (error) {
    await client.query("rollback");
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
