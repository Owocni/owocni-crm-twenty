/** Firmao SMS templates — copy 1:1, do not copy-edit. Source: Dawid sheet 2026-09-15. */

export type SmsTemplate = {
  id: string;
  name: string;
  shortName: string;
  body: string;
};

export const SMS_SENDER = 'Owocni.pl';

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'oferta-marta',
    name: 'Wysłanie pierwszej oferty (Marta)',
    shortName: 'Oferta Marta',
    body: 'Zrobione! Indywidualna propozycja od owocnych powinna być już na mailu. (Czasem w folderze oferty/newsletter) To fajny projekt i chętnie weźmiemy w nim udział. W razie pytań jestem do dyspozycji. Marta z Owocnych. 660 970 980 studio@owocni.pl',
  },
  {
    id: 'oferta-gosia',
    name: 'Wysłanie pierwszej oferty (Gosia)',
    shortName: 'Oferta Gosia',
    body: 'Zrobione! Indywidualna propozycja od owocnych powinna być już na mailu (czasem w folderze oferty/promocje) .To fajny projekt i chętnie weźmiemy w nim udział. W razie pytań jestem do dyspozycji. Pozdrawiam, Małgorzata Zielińska 570 704 470 studio@owocni.pl',
  },
  {
    id: 'przypominajka-gosia',
    name: 'Przypominajka nie przeczytal lub nie odpisuje (Gosia)',
    shortName: 'Przypominajka Gosia',
    body: 'Dzień dobry, tu Gosia ze studia Owocni. Piszę w sprawie wysłanej niedawno oferty. Fajnie byłoby współpracować przy tym projekcie, dlatego podesłałam mailem jeszcze jedną propozycję. Mam nadzieję, że uda nam się stworzyć razem coś pięknego. Małgorzata Zielińska studio@owocni.pl 570 704 470',
  },
  {
    id: 'przypominajka-marta',
    name: 'Przypominajka - Nie przeczytal lub nie odpisuje (Marta)',
    shortName: 'Przypominajka Marta',
    body: 'Dzień dobry, tu Marta ze studia Owocni. Piszę w sprawie wysłanej niedawno oferty. Fajnie byłoby współpracować przy tym projekcie, dlatego podesłałam mailem jeszcze jedną propozycję. Mam nadzieję, że uda nam się stworzyć razem coś pięknego. Marta Słowik studio@owocni.pl 660 970 980',
  },
];
