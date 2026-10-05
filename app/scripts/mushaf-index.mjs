// Derives the mushaf index (surahs and the 240 hizb quarters) from the two local datasets. Pure: no file access here.
// Authority for names, counts and the quarter mark is the King Fahd Complex file; the other file only supplies the
// quarters that begin at the head of a surah, where the Complex text carries no mark inside the ayah.
const RUB = "۞";
/** The only place where the two datasets disagree by one ayah; the Complex mark wins. Any other difference stops the build. */
const EXPECTED_MOVES = ["15:50>15:49"];

export function buildMushafIndex(hafs, simple) {
  if (!Array.isArray(hafs) || hafs.length !== 6236) throw new Error("Invalid Complex dataset");
  const id = new Map(hafs.map((row, i) => [`${row.sura_no}:${row.aya_no}`, i]));
  const surahs = [];
  for (const row of hafs) {
    const last = surahs.at(-1);
    if (last?.no === row.sura_no) last.ayahs += 1;
    else surahs.push({ no: row.sura_no, name: row.sura_name_ar, ayahs: 1 });
  }
  if (surahs.length !== 114 || surahs.some((item, i) => item.no !== i + 1)) throw new Error("Expected 114 surahs in order");
  const starts = [];
  let previous = 0;
  for (const surah of simple.data.surahs) for (const ayah of surah.ayahs) {
    if (ayah.hizbQuarter !== previous) { starts.push(`${surah.number}:${ayah.numberInSurah}`); previous = ayah.hizbQuarter; }
  }
  if (starts.length !== 240) throw new Error(`Expected 240 quarters, found ${starts.length}`);
  const marks = hafs.filter((row) => row.aya_text.includes(RUB)).map((row) => `${row.sura_no}:${row.aya_no}`);
  const moves = [];
  for (const mark of marks) {
    if (starts.includes(mark)) continue;
    const near = starts.findIndex((key) => Math.abs(id.get(key) - id.get(mark)) === 1);
    if (near < 0) throw new Error(`Quarter mark at ${mark} has no neighbouring quarter start`);
    moves.push(`${starts[near]}>${mark}`);
    starts[near] = mark;
  }
  if (moves.join() !== EXPECTED_MOVES.join()) throw new Error(`Unexpected quarter differences: ${moves.join() || "none"}`);
  const marked = new Set(marks);
  for (const key of starts) if (!marked.has(key) && !key.endsWith(":1")) throw new Error(`Unmarked quarter start inside a surah: ${key}`);
  const order = starts.map((key) => id.get(key));
  if (order.some((value, i) => value === undefined || (i > 0 && value <= order[i - 1]))) throw new Error("Quarter starts are not ascending");
  if (order[0] !== 0) throw new Error("The first quarter must start at 1:1");
  const quarterOf = (index) => { let q = 0; while (q < 240 && order[q] <= index) q += 1; return q; };
  return {
    surahs: surahs.map((item) => ({ ...item, quarter: quarterOf(id.get(`${item.no}:1`)) })),
    quarters: starts.map((key) => key.split(":").map(Number)),
  };
}
