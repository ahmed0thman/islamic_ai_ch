const arabicIndic = new Intl.NumberFormat("ar-EG-u-nu-arab", { useGrouping: false });

export const numeral = (value: number) => arabicIndic.format(value);

/** Western digits to Arabic-Indic, for display text only (a source's position field); never for links or data. */
export const arabicDigits = (text: string) => text.replace(/[0-9]/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));
