/** The default MeshMonitor mark, drawn when CUSTOM_LOGO_URL is unset (LoginPage, the Workspace sign-in). */
export default function MeshMonitorLogo({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill="currentColor"
      />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      <path
        d="M7 12L12 7M12 7L17 12M17 12L12 17M12 17L7 12"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
