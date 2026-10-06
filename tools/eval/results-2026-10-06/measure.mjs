import pg from "../../../app/node_modules/pg/lib/index.js";
const which = process.argv[2];
const url = which === "remote" ? process.env.RENDER_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.log("no url for", which); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 1, ssl: which === "remote" ? { rejectUnauthorized: false } : undefined });
try {
  const v = await pool.query("select version() v, current_setting('server_version_num') n, (select string_agg(extname||' '||extversion, ', ') from pg_extension) ext, pg_database_size(current_database()) size");
  console.log(JSON.stringify({ which, ver: v.rows[0].v.slice(0,30), ext: v.rows[0].ext, size_mb: Math.round(v.rows[0].size/1048576) }));
  const t = await pool.query("select schemaname, relname, n_live_tup from pg_stat_user_tables order by 1,2");
  console.log("tables:", t.rows.length, JSON.stringify(t.rows.map(r=>r.schemaname+"."+r.relname)));
  const s = await pool.query("select nspname from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema'");
  console.log("schemas", JSON.stringify(s.rows.map(r=>r.nspname)));
  const cfg = await pool.query("select count(*) c from pg_ts_config where cfgname='arabic'");
  console.log("arabic cfg", cfg.rows[0].c);
  const av = await pool.query("select name, default_version from pg_available_extensions where name='vector'");
  console.log("vector available", JSON.stringify(av.rows));
  if (which !== "remote" || t.rows.some(r=>r.schemaname==="rag")) {
    for (const tb of ["sources","records","evidence","atoms","passages","passage_ayahs","questions"]) {
      try { const r = await pool.query(`select count(*) c from rag.${tb}`); console.log(tb, r.rows[0].c); } catch(e) { console.log(tb, "n/a"); }
    }
    const a = await pool.query("select surah_no, count(*) c, count(embedding) e from rag.atoms group by 1 order by 1");
    console.log("atoms by surah", JSON.stringify(a.rows.map(r=>[r.surah_no,+r.c,+r.e])));
    const sz = await pool.query("select relname, pg_total_relation_size(c.oid) b from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='rag' and relkind in ('r') order by 2 desc");
    console.log("sizes MB", JSON.stringify(sz.rows.map(r=>[r.relname, Math.round(r.b/1048576*10)/10])));
    const pe = await pool.query("select count(*) filter (where embedding is not null) e from rag.passages"); console.log("passage embeddings", pe.rows[0].e);
  }
} catch (e) { console.log("ERR", e.code, e.message.replace(/postgres(ql)?:\/\/\S+/g,"<url>").slice(0,200)); }
finally { await pool.end(); }
