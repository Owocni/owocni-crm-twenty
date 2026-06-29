import { defineFrontComponent } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const STEPS = [
  'Otwórz kartę klienta (Person) z uzupełnionym polem Email.',
  'Naciśnij ⌘K / Ctrl+K i wybierz „Szablony maili”.',
  'Wybierz szablon, edytuj temat i treść, kliknij „Wyślij email”.',
];

const MainPage = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '40px 24px',
        boxSizing: 'border-box',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#eef2ff',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          ✉
        </div>

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 600,
            color: '#1a1a1a',
          }}
        >
          {APP_DISPLAY_NAME}
        </h1>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            lineHeight: 1.6,
            color: '#555',
          }}
        >
          Szablony maili dla handlowców — wysyłka bezpośrednio z Twenty, bez
          Better-Bitrix.
        </p>

        <h2
          style={{
            margin: '0 0 12px',
            fontSize: 13,
            fontWeight: 600,
            color: '#333',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Jak wysłać mail
        </h2>

        <ol
          style={{
            margin: '0 0 24px',
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.7,
            color: '#444',
          }}
        >
          {STEPS.map((step) => (
            <li key={step} style={{ marginBottom: 8 }}>
              {step}
            </li>
          ))}
        </ol>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: '#f8f9fa',
            border: '1px solid #eee',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#666',
          }}
        >
          <strong style={{ color: '#333' }}>Zakładka „Szablony maili”</strong>{' '}
          obok to lista rekordów szablonów (edycja treści i tematów przez
          admina). Do wysyłki używaj pickera z karty Person.
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  description: 'Strona startowa Owocni Mail — instrukcja dla handlowców',
  component: MainPage,
});
