-- Hybrid retrieval of answer units (atoms). One statement; reciprocal rank fusion (k = 60) of
-- 30 lexical candidates (ts_rank_cd over the Arabic text-search configuration) and 30 dense candidates (cosine distance).
-- $1 tsquery text ('' = no lexical leg)      $2 query vector text, e.g. '[0.1,...]' (NULL = no dense leg)
-- $3 open surah      $4 open record id (NULL)      $5 k      $6 reader depth      $7 open stop (NULL)      $8 ids of the earlier turns' atoms
WITH
q AS (
  SELECT CASE WHEN $1::text = '' THEN NULL::tsquery ELSE to_tsquery('arabic', $1::text) END AS tsq,
         $2::text::vector AS vec
),
lex AS (
  SELECT id, (row_number() OVER (ORDER BY r DESC, id))::int AS rnk
  FROM (
    SELECT a.id, ts_rank_cd(a.tsv, q.tsq) AS r
    FROM rag.atoms a, q
    WHERE a.published AND q.tsq IS NOT NULL AND a.tsv @@ q.tsq
    ORDER BY r DESC, a.id
    LIMIT 30
  ) t
),
dense AS (
  SELECT id, (row_number() OVER (ORDER BY d, id))::int AS rnk
  FROM (
    SELECT a.id, a.embedding <=> q.vec AS d
    FROM rag.atoms a, q
    WHERE a.published AND q.vec IS NOT NULL AND a.embedding IS NOT NULL
    ORDER BY d, a.id
    LIMIT 30
  ) t
),
fused AS (
  SELECT u.id, sum(1.0 / (60 + u.rnk))::float8 AS rrf, min(u.rnk) FILTER (WHERE u.src = 'l') AS lex_rank, min(u.rnk) FILTER (WHERE u.src = 'd') AS dense_rank
  FROM (SELECT id, rnk, 'l' AS src FROM lex UNION ALL SELECT id, rnk, 'd' FROM dense) u
  GROUP BY u.id
),
scored AS (
  SELECT a.id, f.rrf, f.lex_rank, f.dense_rank,
         f.rrf + CASE WHEN a.surah_no = $3::int THEN 0.010 ELSE 0 END
               + CASE WHEN $4::text IS NOT NULL AND a.records && ARRAY[$4::text] THEN 0.005 ELSE 0 END AS score
  FROM fused f JOIN rag.atoms a ON a.id = f.id
),
top AS (
  SELECT id, score, lex_rank, dense_rank, (row_number() OVER (ORDER BY score DESC, id))::int AS pos
  FROM (SELECT * FROM scored ORDER BY score DESC, id LIMIT $5::int) s
),
open_stop AS (
  SELECT id FROM rag.atoms
  WHERE published AND $7::int IS NOT NULL AND surah_no = $3::int
    AND locations @> jsonb_build_array(jsonb_build_object('depth', $6::int, 'stops', jsonb_build_array($7::int)))
),
hist AS (
  SELECT id FROM rag.atoms WHERE published AND id = ANY ($8::text[])
),
chosen AS (
  SELECT id, 0 AS grp FROM open_stop
  UNION ALL SELECT id, 1 FROM top
  UNION ALL SELECT id, 2 FROM hist
),
defs AS (
  SELECT d.id, 3 AS grp
  FROM rag.atoms d
  WHERE d.published AND d.role = 'definition'
    AND d.records && (SELECT coalesce(array_agg(DISTINCT r), '{}') FROM rag.atoms a JOIN chosen c ON c.id = a.id, unnest(a.records) AS r)
),
picked AS (
  SELECT id, min(grp) AS grp FROM (SELECT * FROM chosen UNION ALL SELECT * FROM defs) x GROUP BY id
)
SELECT a.id, a.depth AS level, a.role, a.segments, a.records, a.text, a.locations,
       p.grp, t.pos, t.score, t.lex_rank, t.dense_rank,
       (SELECT count(*) FROM lex)::int AS n_lex, (SELECT count(*) FROM dense)::int AS n_dense
FROM picked p
JOIN rag.atoms a ON a.id = p.id
LEFT JOIN top t ON t.id = p.id
ORDER BY p.grp, t.pos NULLS LAST, a.seq, a.id;
