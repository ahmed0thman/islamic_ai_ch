/**
 * Fixed-code checks on the question itself, made before any model call (and so before any retrieval).
 * Each rule only ever ends the request with a status the app already has (`out_of_scope` or `fatwa`), never with text.
 * The rules are narrow on purpose: a question that is merely near one of them goes on to the model as before.
 */
export type PrecheckStatus = "out_of_scope" | "fatwa";
export type PrecheckRule = "compose_quran" | "present_as_ayah" | "ignore_instructions" | "personal_ruling";

// Same folding the answer guard uses for Arabic: no marks or tatweel, hamza forms and alef maqsura, teh marbuta unified.
const fold = (text: string) => text.normalize("NFD")
  .replace(/[ً-ٰٟۖ-ۭـ]/gu, "")
  .replace(/[آأإٱ]/gu, "ا").replace(/ى/gu, "ي").replace(/ة/gu, "ه")
  .replace(/[«»"“”﴾﴿]/gu, " ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();

// Words that ask for something to be made (compose, invent, imitate). The bare word "alf" is left out: it also means "thousand".
const MAKE = "(?:اكتب|اكتبي|ولد|ولدي|انشئ|ابتكر|ابتكري|اخترع|انتج|صغ|صوغ|اصنع|انظم|ركب|قلد|حاك|حاكي|الف لي|الف لنا|تاليف)";
const QURAN = "(?:سوره|سورا|ايه|ايات|ايتين|قران|قرانا)";
const STYLE = /(?:نمط|اسلوب|طريقه|غرار|شاكله|محاكاه|تقليد|منوال|مثال|شبيه|تشبه|يشبه|مشابه|بنفس|بلغه القران)/u;
// Between the verb and "surah" only a pronoun-like word may stand, so that "write a tafsir of surah X in the style of Y" is not caught.
const COMPOSE_STYLE = new RegExp(`(?:^| )${MAKE}((?: \\S+){0,2}) ${QURAN}(?: |$)`, "u");
const EXPLAINING = /(?:تفسير|شرح|معني|تدبر|ملخص|تلخيص|قصه|مقال|بحث|خطبه|درس|موضوع|فقره|اعراب|ترجمه)/u;
const COMPOSE_ALWAYS = new RegExp(`(?:^| )(?:ولد|ولدي|انشئ|ابتكر|ابتكري|اخترع|قلد|حاك|حاكي|الف لي|الف لنا|اصنع|انظم|ركب)((?: \\S+){0,2}) ${QURAN}(?: |$)`, "u");
const OWN_MAKING = /(?:جديده|من عندك|من تاليفك|من انشائك|من خيالك|من نظمك)/u;
const IGNORE = /(?:^| )(?:تجاهل|تجاهلي|انس|اهمل|تخط|الغ|ابطل)(?: \S+){0,2} (?:تعليماتك|التعليمات|تعليمات|ما سبق|قواعدك|اوامرك|القيود|برمجتك|توجيهاتك|ما قيل لك)(?: |$)/u;
const IGNORE_LATIN = /ignore\s+(?:all\s+|any\s+|your\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|rules|prompts?)/iu;
const PRESENT_AS_AYAH = /(?:^| )(?:اعرض|اكتب|قدم|اعتبر|اظهر|اعتمد|سم|اذكر)(?: \S+){0,8} علي انها? (?:ايه|ايات|قران|من القران)(?: |$)/u;
const PERSONAL_RULING = [
  /(?:^| )هل (?:يجوز|يحل|يصح|يلزم|ينفع) (?:لي|لنا)(?: |$)/u,
  /(?:^| )(?:صلاتي|صيامي|زكاتي|حجي|وضوئي|طلاقي|زواجي|نكاحي|توبتي|عمرتي|صدقتي|غسلي)(?: \S+)? (?:باطل|باطله|صحيح|صحيحه|مقبول|مقبوله|تصح|مجزيه|مجزئ|تجزئ)(?: |$)/u,
];

/** The rule that ends the question here, if one does, with the status to reply with. */
export function precheck(question: string): { rule: PrecheckRule; status: PrecheckStatus } | undefined {
  const text = fold(question);
  const style = COMPOSE_STYLE.exec(text);
  const always = COMPOSE_ALWAYS.exec(text);
  if ((always && !EXPLAINING.test(always[1])) || (style && !EXPLAINING.test(style[1]) && (STYLE.test(text) || OWN_MAKING.test(text)))) return { rule: "compose_quran", status: "out_of_scope" };
  if (IGNORE.test(text) || IGNORE_LATIN.test(question)) return { rule: "ignore_instructions", status: "out_of_scope" };
  if (PRESENT_AS_AYAH.test(text)) return { rule: "present_as_ayah", status: "out_of_scope" };
  if (PERSONAL_RULING.some((rule) => rule.test(text))) return { rule: "personal_ruling", status: "fatwa" };
  return undefined;
}
