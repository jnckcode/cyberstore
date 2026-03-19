import * as React from "react";

import { cn } from "@/lib/utils";

export interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {}

const Label = React.forwardRef<HTMLSpanElement, LabelProps>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("text-sm font-medium leading-none", className)} {...props} />
));
Label.displayName = "Label";

export { Label };
