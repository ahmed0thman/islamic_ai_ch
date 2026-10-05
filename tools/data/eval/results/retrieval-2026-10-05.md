# Retrieval evaluation (held)

Only held-out results may be announced.

Primary scores exclude title_is_gold, needs_history and empty gold; title_is_gold scores are separate.

Macro recall uses gold_atoms only. Context-only atoms are excluded from ranking.

Semantic fallback is unavailable, never a semantic score. Hybrid degradation is counted explicitly.

Latency includes embedding warm-up and uses successful retrievals; semantic fallback is excluded.

The set favours easier, standalone titles. Recall is a lower bound when equivalent atoms exist in other depths.

These numbers measure retrieval, not religious correctness.

| mode | recall@8 | recall@24 | MRR@10 | p50 (ms) | p95 (ms) | n |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lexical | 0.3818 | 0.3947 | 0.4200 | 3.4973 | 7.6145 | 26 |
| semantic | 0.3113 | 0.4288 | 0.3873 | 10.3956 | 25.7177 | 26 |
| hybrid | 0.3221 | 0.5089 | 0.4602 | 8.8482 | 14.9537 | 26 |

## Title is gold (separate)

| mode | recall@8 | recall@24 | MRR@10 | p50 (ms) | p95 (ms) | n |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lexical | 0.4963 | 0.6074 | 1.0000 | 4.6310 | 8.3114 | 3 |
| semantic | 0.4963 | 0.6259 | 1.0000 | 15.4897 | 19.2661 | 3 |
| hybrid | 0.4963 | 0.7370 | 1.0000 | 11.6323 | 12.7482 | 3 |

lexical: semantic unavailable=0; retrieval unavailable=0; attempted=36.

semantic: semantic unavailable=0; retrieval unavailable=0; attempted=36.

hybrid: semantic unavailable=0; retrieval unavailable=0; attempted=36.
