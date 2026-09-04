import { CopyButton } from '@dendelion/paper-ui';
import { inlineCodeClassName } from './inline-code-style';

export interface CommandLineProps {
  command: string;
}

// paper-ui has no inline-code component, and its CodeBlock is a dark box that scrolls
// rather than wraps — wrong for a one-line command in a narrow column.
export const CommandLine = ({ command }: CommandLineProps) => (
  <div className="flex min-w-0 items-start justify-between gap-2">
    <code className={`${inlineCodeClassName} min-w-0 break-words text-xs`}>{command}</code>
    <CopyButton text={command} className="shrink-0" />
  </div>
);
