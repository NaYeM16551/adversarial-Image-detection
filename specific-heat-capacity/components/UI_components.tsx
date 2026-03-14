const THEME_COLOR = '#3389AD';
export function Panel({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`bg-[#2a2a2a] rounded-lg p-3 ${className}`}
      style={{ border: `1px solid ${THEME_COLOR}40` }}
    >
      {title && (
        <h3 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}