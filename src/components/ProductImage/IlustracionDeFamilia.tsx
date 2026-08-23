import { Familia } from '../../utils/ilustracion';

/**
 * El motivo de cada familia. Son trazos, no iconos de biblioteca: heredan
 * `currentColor`, así que el color lo pone quien los usa y no hay que mantener
 * una paleta adentro de cada dibujo.
 *
 * Todos comparten la misma línea de horizonte para que una grilla mezclada se
 * lea como un conjunto y no como siete dibujos distintos.
 */
export function IlustracionDeFamilia({ familia }: { familia: Familia }) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* El horizonte, común a todas. */}
      <line x1="8" y1="56" x2="112" y2="56" opacity="0.45" />
      {motivo(familia)}
    </svg>
  );
}

function motivo(familia: Familia) {
  switch (familia) {
    // Surcos en perspectiva y un brote.
    case 'cultivo':
      return (
        <>
          <path d="M20 74 L44 56 M50 74 L60 56 M80 74 L76 56 M110 74 L92 56" opacity="0.5" />
          <path d="M60 46 V28" />
          <path d="M60 36 C60 30 55 26 49 26 C49 32 54 36 60 36 Z" />
          <path d="M60 30 C60 24 65 20 71 20 C71 26 66 30 60 30 Z" />
        </>
      );
    // Una rueda de tractor y su eje.
    case 'maquinaria':
      return (
        <>
          <circle cx="42" cy="42" r="14" />
          <circle cx="42" cy="42" r="5" />
          <circle cx="82" cy="46" r="10" />
          <path d="M42 28 V22 H74 V36" />
          <path d="M56 42 H72" opacity="0.6" />
        </>
      );
    // Un rollo de forraje y el lomo de un animal.
    case 'ganado':
      return (
        <>
          <circle cx="34" cy="44" r="12" />
          <path d="M34 32 V56 M22 44 H46" opacity="0.5" />
          <path d="M64 48 V38 C64 32 70 28 78 28 H88 C94 28 98 32 98 38 V48" />
          <path d="M70 48 V56 M92 48 V56" />
          <path d="M64 38 L58 34" />
        </>
      );
    // Gota y el arco de un pivote.
    case 'agua':
      return (
        <>
          <path d="M60 18 C60 18 48 32 48 40 A12 12 0 0 0 72 40 C72 32 60 18 60 18 Z" />
          <path d="M24 56 A36 36 0 0 1 96 56" opacity="0.45" />
          <path d="M36 62 V68 M60 64 V70 M84 62 V68" opacity="0.6" />
        </>
      );
    // Parcelas y el horizonte.
    case 'tierra':
      return (
        <>
          <path d="M18 56 L46 34 H86 L102 56" opacity="0.5" />
          <path d="M46 34 V56 M86 34 V56 M32 45 H98" opacity="0.5" />
          <path d="M18 64 H102" opacity="0.35" />
        </>
      );
    // Señal sobre el campo.
    case 'tecnologia':
      return (
        <>
          <rect x="48" y="30" width="24" height="16" rx="3" />
          <path d="M60 30 V20" />
          <circle cx="60" cy="17" r="3" />
          <path d="M40 22 A28 28 0 0 1 80 22" opacity="0.45" />
          <path d="M46 14 A38 38 0 0 1 74 14" opacity="0.3" />
          <path d="M60 46 V56" opacity="0.6" />
        </>
      );
    // Recorrido y acoplado.
    case 'logistica':
      return (
        <>
          <rect x="26" y="32" width="34" height="18" rx="2" />
          <path d="M60 38 H76 L86 46 V50 H60 Z" />
          <circle cx="42" cy="54" r="5" />
          <circle cx="78" cy="54" r="5" />
          <path d="M14 64 C34 68 56 60 74 64 C88 67 98 64 106 60" opacity="0.4" />
        </>
      );
    // Sin familia: una espiga sola.
    default:
      return (
        <>
          <path d="M60 62 V26" />
          <path d="M60 34 C60 28 54 24 47 24 C47 31 53 34 60 34 Z" />
          <path d="M60 44 C60 38 54 34 47 34 C47 41 53 44 60 44 Z" />
          <path d="M60 34 C60 28 66 24 73 24 C73 31 67 34 60 34 Z" />
          <path d="M60 44 C60 38 66 34 73 34 C73 41 67 44 60 44 Z" />
        </>
      );
  }
}
