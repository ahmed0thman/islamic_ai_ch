/** The surahs the reader publishes, in the order they are shown (decision 141: every surah in the delivery scope is published now, and what is not yet reviewed is reviewed tonight). The content files of the other surahs stay as they are. */
export const publishedSurahs: readonly number[] = [93, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];

/** The published surahs only, in the order of `publishedSurahs`. A published number the list does not contain is an error, not a silent gap. */
export function onlyPublished<T extends { no: number }>(surahs: readonly T[], published: readonly number[] = publishedSurahs): T[] {
  return published.map((no) => {
    const found = surahs.find((item) => item.no === no);
    if (!found) throw new Error(`Published surah ${no} is missing from the content index`);
    return found;
  });
}
