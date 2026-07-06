import { Button, type ButtonProps } from '@dendelion/paper-ui';

type Intent = 'go' | 'stop' | 'log';

const INTENT_CLASS: Record<Intent, string> = {
  go: 'intent-button-go',
  stop: 'intent-button-stop',
  log: 'intent-button-log',
};

interface IntentButtonProps extends Omit<ButtonProps, 'variant'> {
  /** go = affirmative/approve/start, stop = halt/reject/discard, log = record an entry. */
  intent: Intent;
}

/**
 * paper-ui's Button has no variant that fills its blob with an arbitrary color, so
 * intent (go/stop/log) is expressed by recoloring the SVG fill from outside — see the
 * .intent-button-* rules in utilities.css for why that needs `!important`. Centralizing
 * it here names the color-per-meaning mapping once instead of at each call site.
 */
export const IntentButton = ({ intent, className, ...props }: IntentButtonProps) => (
  <Button
    variant="primary"
    className={className ? `${INTENT_CLASS[intent]} ${className}` : INTENT_CLASS[intent]}
    {...props}
  />
);
