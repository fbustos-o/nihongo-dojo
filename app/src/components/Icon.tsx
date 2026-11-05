import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Flame,
  Home,
  Info,
  Library,
  Lock,
  Map as MapIcon,
  Pencil,
  Play,
  Repeat,
  Settings,
  Star,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';

/** The icon set of the app (lucide, MIT). Add names here; never import lucide directly elsewhere. */
const ICONS = {
  home: Home,
  map: MapIcon,
  repeat: Repeat,
  pencil: Pencil,
  book: BookOpen,
  vocab: Library,
  settings: Settings,
  info: Info,
  check: Check,
  lock: Lock,
  play: Play,
  clock: Clock,
  volume: Volume2,
  flame: Flame,
  star: Star,
  x: X,
  alert: CircleAlert,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  /** Pixel size (default 20). */
  size?: number;
  /** Stroke width (default 2). */
  strokeWidth?: number;
  className?: string;
  /** Accessible name; when given the icon is exposed as an image, otherwise it is decorative (`aria-hidden`). */
  title?: string;
}

export function Icon({ name, size = 20, strokeWidth = 2, className, title }: IconProps) {
  const Cmp = ICONS[name];
  const cls = className ? `ico ${className}` : 'ico';
  return title ? (
    <Cmp size={size} strokeWidth={strokeWidth} className={cls} role="img" aria-label={title} />
  ) : (
    <Cmp size={size} strokeWidth={strokeWidth} className={cls} aria-hidden="true" focusable="false" />
  );
}
