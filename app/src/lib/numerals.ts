const arabicIndic = new Intl.NumberFormat("ar-EG-u-nu-arab", { useGrouping: false });

export const numeral = (value: number) => arabicIndic.format(value);
