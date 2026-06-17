/* Iconos de línea neón para la landing — reemplazan los emojis para
   que se vean idénticos en todos los dispositivos. Tamaño 1em: heredan
   el font-size del contenedor (igual que un emoji). */

function Ic({ children, viewBox = "0 0 24 24" }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: "1em", height: "1em", display: "inline-block", verticalAlign: "-0.12em" }}
    >
      {children}
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <Ic>
      <path d="M12 2.5 19.5 5.5v5c0 4.6-3.1 8.7-7.5 10.2C7.6 19.2 4.5 15.1 4.5 10.5v-5L12 2.5Z" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m8.8 12 2.2 2.2 4.2-4.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Ic>
  );
}

export function ScaleIcon() {
  return (
    <Ic>
      <path d="M12 4v15M7.5 19.5h9M5 7.5h14" stroke="#9ed819" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 7.5 2.8 13a2.6 2.6 0 0 0 4.4 0L5 7.5ZM19 7.5 16.8 13a2.6 2.6 0 0 0 4.4 0L19 7.5Z" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="4.2" r="1.4" fill="#fff" />
    </Ic>
  );
}

export function PhoneIcon() {
  return (
    <Ic>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.6" fill="rgba(158,216,25,0.12)" stroke="#9ed819" strokeWidth="1.7" />
      <path d="M10.5 18.4h3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m10 9.8 1.6 1.6 2.8-3" stroke="#9ed819" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Ic>
  );
}

export function LockIcon() {
  return (
    <Ic>
      <rect x="5.5" y="10" width="13" height="10" rx="2.6" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.7" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="#9ed819" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.4" r="1.5" fill="#fff" />
      <path d="M12 15.6v1.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </Ic>
  );
}

export function PersonIcon() {
  return (
    <Ic>
      <circle cx="12" cy="8" r="3.6" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.7" />
      <path d="M4.8 20.2c.9-3.7 3.8-5.7 7.2-5.7s6.3 2 7.2 5.7" stroke="#9ed819" strokeWidth="1.7" strokeLinecap="round" />
    </Ic>
  );
}

export function CashIcon() {
  return (
    <Ic>
      <rect x="2.8" y="6.5" width="18.4" height="11" rx="2" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.7" stroke="#fff" strokeWidth="1.5" />
      <path d="M6 9.5h.01M18 14.5h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </Ic>
  );
}

export function BoltIcon() {
  return (
    <Ic>
      <path d="M13.4 2.2 5.6 13.3h4.4l-1.6 8.5 8-11.6h-4.5l1.5-8Z" fill="#9ed819" stroke="#cdf36b" strokeWidth="0.8" strokeLinejoin="round" />
    </Ic>
  );
}

export function FlagIcon() {
  return (
    <Ic>
      <path d="M5.5 21V3.5" stroke="#9ed819" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5.5 4h12.7l-2.6 4 2.6 4H5.5" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.6" strokeLinejoin="round" />
    </Ic>
  );
}

export function LockIconDark() {
  return (
    <Ic>
      <rect x="5.5" y="10" width="13" height="10" rx="2.6" fill="rgba(11,41,39,0.25)" stroke="#0b2927" strokeWidth="1.7" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="#0b2927" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="14.4" r="1.5" fill="#479818" />
      <path d="M12 15.6v1.8" stroke="#0b2927" strokeWidth="1.5" strokeLinecap="round" />
    </Ic>
  );
}

export function DollarIcon() {
  return (
    <Ic>
      <circle cx="12" cy="12" r="9" fill="#0b2927" stroke="#9ed819" strokeWidth="1.8" />
      <path
        d="M13.4 7.2H11.2c-1.05 0-1.9.62-1.9 1.45s.85 1.35 2.05 1.35 2.05.62 2.05 1.5-.9 1.45-2.05 1.45H10.6"
        stroke="#9ed819"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M12 6.3v11.4" stroke="#9ed819" strokeWidth="2" strokeLinecap="round" />
    </Ic>
  );
}

export function BankIcon() {
  return (
    <Ic>
      <path d="m12 3 8.5 5h-17L12 3Z" fill="rgba(158,216,25,0.16)" stroke="#9ed819" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 10.5v6M9.7 10.5v6M14.3 10.5v6M19 10.5v6" stroke="#9ed819" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 19.5h17" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </Ic>
  );
}

export function BellIcon() {
  return (
    <Ic>
      <path d="M12 3.2a5.2 5.2 0 0 0-5.2 5.2v2.4l-1.4 2.3a1.2 1.2 0 0 0 1 1.8h11.2a1.2 1.2 0 0 0 1-1.8l-1.4-2.3V8.4A5.2 5.2 0 0 0 12 3.2Z" fill="rgba(158,216,25,0.14)" stroke="#9ed819" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 18.8a2 2 0 0 0 4 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </Ic>
  );
}

export const STEP_ICONS = {
  shield: ShieldIcon,
  bolt: BoltIcon,
  cash: CashIcon,
  lock: LockIcon,
  scale: ScaleIcon,
  bank: BankIcon,
  dollar: DollarIcon,
  lockDark: LockIconDark,
  person: PersonIcon,
  flag: FlagIcon,
};
