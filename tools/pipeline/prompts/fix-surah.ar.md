<div dir="rtl">

# تكليف: إصلاح سورة {{surah_name}} ({{surah_no}}) بعد فشل الفحص

بُنيت سجلات السورة ونسيجها بتكليف `tools/pipeline/prompts/build-surah.ar.md` (اقرأه: حدوده وقواعده كلها تنطبق هنا)، ثم فشل الفحص الآلي. الناتج الحرفي للفحص:

```text
{{gate_output}}
```

أصلح السبب في ملفات السورة وحدها (`.cache/records/{{surah_no}}/` و`content/nasij/{{surah_no}}.json`) حتى يمر:

- `python3 -B .cache/records/108/check_v2.py {{surah_no}}` بلا فشل صلب.
- `python3 -B tools/export_content.py {{surah_no}} --check-only` كله.

القاعدة: الفحص لا يُرضى بحذف العلامة أو تغيير إذن سجل. إن كانت جملة لا يحملها سجل إذن بنائه «نعم»، فانقلها إلى `held` بسببها. لا تعدّل سكربتات الفحص ولا المصدِّر.

التقرير: ما كان السبب، وما غيّرته، وناتج الفحصين.

</div>
