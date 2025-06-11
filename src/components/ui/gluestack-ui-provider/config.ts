"use client";
import { vars } from "nativewind";

export const config = {
  light: vars({
    /* Primary colors */
    "--color-primary": "30 60 90", // #1e3c5a
    "--color-secondary": "42 77 109", // #2a4d6d
    "--color-tertiary": "61 93 125", // #3d5d7d

    /* Status colors */
    "--color-error": "220 38 38", // #DC2626
    "--color-success": "22 163 74", // #16A34A
    "--color-warning": "217 119 6", // #D97706
    "--color-info": "37 99 235", // #2563EB

    /* Typography */
    "--color-typography": "26 26 26", // #1A1A1A
    "--color-typography-secondary": "100 116 139", // #64748B
    "--color-typography-contrast": "255 255 255", // #FFFFFF
    "--color-typography-accent": "30 60 90", // #1e3c5a

    /* Outline */
    "--color-outline": "226 232 240", // #E2E8F0
    "--color-outline-accent": "30 60 90", // #1e3c5a

    /* Background */
    "--color-background": "245 247 250", // #F5F7FA
    "--color-background-secondary": "255 255 255", // #FFFFFF
    "--color-background-elevated": "30 60 90", // #1e3c5a
    "--color-background-interactive": "243 244 246", // #F3F4F6

    /* Background Special */
    "--color-background-error": "254 226 226", // #FEE2E2
    "--color-background-warning": "254 243 199", // #FEF3C7
    "--color-background-success": "220 252 231", // #DCFCE7
    "--color-background-muted": "243 244 246", // #F3F4F6
    "--color-background-info": "219 234 254", // #DBEAFE
    "--color-background-loading": "243 244 246", // #F3F4F6

    /* Status borders */
    "--color-border-error": "239 68 68", // #EF4444
    "--color-border-success": "34 197 94", // #22C55E
    "--color-border-warning": "245 158 11", // #F59E0B
    "--color-border-info": "59 130 246", // #3B82F6
    "--color-border-loading": "156 163 175", // #9CA3AF

    /* Status foregrounds */
    "--color-foreground-loading": "107 114 128", // #6B7280

    /* Focus Ring Indicator */
    "--color-indicator-primary": "30 60 90", // #1e3c5a
    "--color-indicator-info": "37 99 235", // #2563EB
    "--color-indicator-error": "220 38 38", // #DC2626
  }),
  dark: vars({
    /* Primary colors */
    "--color-primary": "229 203 135", // #e5cb87
    "--color-secondary": "212 186 118", // #d4ba76
    "--color-tertiary": "61 93 125", // #3d5d7d

    /* Status colors */
    "--color-error": "252 165 165", // #FCA5A5
    "--color-success": "134 239 172", // #86EFAC
    "--color-warning": "252 211 77", // #FCD34D
    "--color-info": "147 197 253", // #93C5FD

    /* Typography */
    "--color-typography": "229 203 135", // #e5cb87
    "--color-typography-secondary": "184 197 211", // #b8c5d3
    "--color-typography-contrast": "255 255 255", // #FFFFFF
    "--color-typography-accent": "229 203 135", // #e5cb87

    /* Outline */
    "--color-outline": "255 255 255 10", // rgba(255,255,255,0.1) - using 10% opacity
    "--color-outline-accent": "229 203 135", // #e5cb87

    /* Background */
    "--color-background": "30 60 90", // #1e3c5a
    "--color-background-secondary": "42 77 109", // #2a4d6d
    "--color-background-elevated": "61 93 125", // #3d5d7d
    "--color-background-interactive": "61 93 125", // #3d5d7d

    /* Background Special */
    "--color-background-error": "127 29 29", // #7F1D1D
    "--color-background-warning": "120 53 15", // #78350F
    "--color-background-success": "20 83 45", // #14532D
    "--color-background-muted": "31 41 55", // #1F2937
    "--color-background-info": "30 58 138", // #1E3A8A
    "--color-background-loading": "31 41 55", // #1F2937

    /* Status borders */
    "--color-border-error": "239 68 68", // #EF4444
    "--color-border-success": "34 197 94", // #22C55E
    "--color-border-warning": "245 158 11", // #F59E0B
    "--color-border-info": "59 130 246", // #3B82F6
    "--color-border-loading": "75 85 99", // #4B5563

    /* Status foregrounds */
    "--color-foreground-loading": "209 213 219", // #D1D5DB

    /* Focus Ring Indicator */
    "--color-indicator-primary": "229 203 135", // #e5cb87
    "--color-indicator-info": "147 197 253", // #93C5FD
    "--color-indicator-error": "252 165 165", // #FCA5A5
  }),
};
