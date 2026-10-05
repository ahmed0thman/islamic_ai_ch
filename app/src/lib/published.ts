/** The surahs the reader publishes, in the order they are shown (decision 076: depth over breadth). The content files of the other surahs stay as they are. */
export const publishedSurahs: readonly number[] = [93, 108, 107, 112];

/** The published surahs only, in the order of `publishedSurahs`. A published number the list does not contain is an error, not a silent gap. */
export function onlyPublished<T extends { no: number }>(surahs: readonly T[], published: readonly number[] = publishedSurahs): T[] {
  return published.map((no) => {
    const found = surahs.find((item) => item.no === no);
    if (!found) throw new Error(`Published surah ${no} is missing from the content index`);
    return found;
  });
}
