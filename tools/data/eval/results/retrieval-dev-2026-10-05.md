# Retrieval evaluation (dev)

Only held-out results may be announced.

Primary scores exclude title_is_gold, needs_history and empty gold; title_is_gold scores are separate.

Macro recall uses gold_atoms only. Context-only atoms are excluded from ranking.

Semantic fallback is unavailable, never a semantic score. Hybrid degradation is counted explicitly.

Latency includes embedding warm-up and uses successful retrievals; semantic fallback is excluded.

The set favours easier, standalone titles. Recall is a lower bound when equivalent atoms exist in other depths.

These numbers measure retrieval, not religious correctness.

| mode | recall@8 | recall@24 | MRR@10 | p50 (ms) | p95 (ms) | n |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lexical | 0.3111 | 0.3752 | 0.3987 | 3.3258 | 6.2085 | 45 |
| semantic | 0.3378 | 0.4015 | 0.3973 | 10.9530 | 18.1133 | 45 |
| hybrid | 0.3326 | 0.4852 | 0.4939 | 8.7378 | 16.9850 | 45 |

## Title is gold (separate)

| mode | recall@8 | recall@24 | MRR@10 | p50 (ms) | p95 (ms) | n |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lexical | 0.5556 | 0.6806 | 1.0000 | 5.4820 | 9.1729 | 6 |
| semantic | 0.5972 | 0.6806 | 1.0000 | 17.0636 | 19.6491 | 6 |
| hybrid | 0.5806 | 0.7611 | 1.0000 | 14.8819 | 18.2021 | 6 |

lexical: semantic unavailable=0; retrieval unavailable=0; attempted=66.

semantic: semantic unavailable=0; retrieval unavailable=0; attempted=66.

hybrid: semantic unavailable=0; retrieval unavailable=0; attempted=66.
