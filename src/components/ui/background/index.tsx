import { Box } from "@/components/ui/box";
import { forwardRef } from "react";

type BackgroundProps = {
  children?: React.ReactNode;
  className?: string;
  style?: any;
};

export const Background = forwardRef<any, BackgroundProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <Box className={`bg-background flex-1 h-full w-full ${className}`} {...props} ref={ref}>
        {children}
      </Box>
    );
  }
);

Background.displayName = "Background";
