import type { LucideIcon } from 'lucide-react';
import type { AriaAttributes } from 'react';

type IconRendererProps = {
    iconNode: LucideIcon;
    className?: string;
} & AriaAttributes;

function IconRenderer({ iconNode: IconComponent, className, ...props }: IconRendererProps) {
    if (!IconComponent) {
        return null;
    }

    return <IconComponent className={className} {...props} />;
}

export { IconRenderer };
export type { IconRendererProps };
