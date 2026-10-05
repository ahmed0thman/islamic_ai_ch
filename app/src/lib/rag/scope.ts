/** Dictionary / definition sources (scope b): searched lexically for any surah, not only the passages linked to it. */
export const DEFINITION_SOURCES: readonly string[] = [
  "mufradat", "tarifat", "mujam_ulum", "idah", "irab_darwish", "mokhtasar", "moyassar", "seraj", "maqasid",
];
/** Scope (a): passages linked to an ayah of the surahs from this number to the last one. */
export const PASSAGE_SURAH_MIN = 78;
export const PASSAGE_SURAH_MAX = 114;
export const EMBED_MODEL_NAME = "Xenova/multilingual-e5-small";
/** Stored in `embedding_model`; changing the model or its quantisation changes this tag, so stale vectors are found and re-made. */
export const EMBED_MODEL_TAG = `${EMBED_MODEL_NAME}@q8`;
export const EMBED_DIMENSIONS = 384;
