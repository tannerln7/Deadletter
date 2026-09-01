import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const sharedProps: IconProps = {
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
};

export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M4.5 7.5h15v11h-15z" />
      <path d="M3.5 4.5h17v3h-17zM9 11.25h6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M6 3.5v3M18 3.5v3M4 8.5h16M4.5 5.5h15v15h-15z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function DocumentIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9 12h6M9 15.5h6" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M12 3.5v11M8 10.5l4 4 4-4M5 19.5h14" />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M13 5h6v6M19 5l-8 8" />
      <path d="M10 6H5v13h13v-5" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M2.75 12s3.25-5 9.25-5 9.25 5 9.25 5-3.25 5-9.25 5-9.25-5-9.25-5Z" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m5.5 17 4.5-4 3 2.5 2.5-2 3 3.5" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M20 15.25A8.5 8.5 0 0 1 8.75 4a8.5 8.5 0 1 0 11.25 11.25Z" />
    </svg>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m8.5 12.5 5.7-5.7a3 3 0 1 1 4.2 4.2l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4l7.4-7.4" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}
