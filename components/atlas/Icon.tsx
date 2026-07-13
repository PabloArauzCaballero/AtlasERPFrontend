interface IconProps {
  name: string;
  className?: string;
  label?: string;
}

/** Renders a Material Symbols icon while keeping an accessible label when needed. */
export function Icon({ name, className = '', label }: IconProps) {
  return (
    <span className={`material-symbols-outlined select-none ${className}`} aria-hidden={label ? undefined : true} aria-label={label}>
      {name}
    </span>
  );
}
