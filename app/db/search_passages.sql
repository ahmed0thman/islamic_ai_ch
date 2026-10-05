-- Hybrid retrieval of book passages for one surah: 30 lexical + 30 dense candidates, reciprocal rank fusion (k = 60).
-- Pool: passages linked through rag.passage_ayahs to an ayah of the surah, plus (lexical leg only) the passages of the
-- dictionary / definition sources named in $6. Dense leg: linked passages that carry an embedding.
-- $1 tsquery text ('' = no lexical leg)   $2 query vector text (NULL = no dense leg)   $3 surah   $4 ayah keys of the open stop (NULL)
-- $5 k   $6 dictionary / definition source ids
WITH
q AS (
  SELECT CASE WHEN $1::text = '' THEN NULL::tsquery ELSE to_tsquery('arabic', $1::text) END AS tsq,
         $2::text::vector AS vec
),
linked AS (
  SELECT DISTINCT passage_id FROM rag.passage_ayahs WHERE ayah_key LIKE ($3::int)::text || ':%'
),
lex AS (
  SELECT id, (row_number() OVER (ORDER BY r DESC, id))::int AS rnk
  FROM (
    SELECT p.id, ts_rank_cd(p.tsv, q.tsq) AS r
    FROM rag.passages p, q
    WHERE q.tsq IS NOT NULL AND p.tsv @@ q.tsq
      AND (p.id IN (SELECT passage_id FROM linked) OR p.source_id = ANY ($6::text[]))
    ORDER BY r DESC, p.id
    LIMIT 30
  ) t
),
dense AS (
  SELECT id, (row_number() OVER (ORDER BY d, id))::int AS rnk
  FROM (
    SELECT p.id, p.embedding <=> q.vec AS d
    FROM rag.passages p, q
    WHERE q.vec IS NOT NULL AND p.embedding IS NOT NULL AND p.id IN (SELECT passage_id FROM linked)
    ORDER BY d, p.id
    LIMIT 30
  ) t
),
fused AS (
  SELECT u.id, sum(1.0 / (60 + u.rnk))::float8 AS rrf
  FROM (SELECT id, rnk FROM lex UNION ALL SELECT id, rnk FROM dense) u
  GROUP BY u.id
),
scored AS (
  SELECT f.id,
         f.rrf + CASE WHEN $4::text[] IS NOT NULL AND EXISTS (
           SELECT 1 FROM rag.passage_ayahs pa WHERE pa.passage_id = f.id AND pa.ayah_key = ANY ($4::text[])) THEN 0.010 ELSE 0 END AS score
  FROM fused f
)
SELECT p.id::text AS id, p.source_id, coalesce(s.title, '') AS source_title, coalesce(s.author, '') AS author,
       p.part, p.printed_page, p.page_id, p.unit_kind, p.url, p.text, sc.score,
       coalesce((SELECT array_agg(DISTINCT pa.ayah_key ORDER BY pa.ayah_key) FROM rag.passage_ayahs pa
                 WHERE pa.passage_id = p.id AND pa.ayah_key LIKE ($3::int)::text || ':%'), '{}') AS ayah_keys,
       (SELECT count(*) FROM lex)::int AS n_lex, (SELECT count(*) FROM dense)::int AS n_dense
FROM (SELECT * FROM scored ORDER BY score DESC, id LIMIT $5::int) sc
JOIN rag.passages p ON p.id = sc.id
LEFT JOIN rag.sources s ON s.id = p.source_id
ORDER BY sc.score DESC, p.id;
