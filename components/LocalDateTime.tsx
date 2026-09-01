"use client";

type LocalDateTimeProps = {
  className?: string;
  date: string;
  includeTime?: boolean;
};

export default function LocalDateTime({
  className,
  date,
  includeTime = true,
}: LocalDateTimeProps) {
  const value = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(date));

  return (
    <time className={className} dateTime={date} suppressHydrationWarning>
      {value}
    </time>
  );
}
