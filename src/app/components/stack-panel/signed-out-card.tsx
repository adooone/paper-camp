import { useAgentAuthStatus } from '@/app/hooks/use-agent-auth-status';
import { refreshAgentAuthStatus } from '@/app/services/query-client';
import { checkAgentSignIn } from '@/app/services/system';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { Button, Card, Tooltip, useToast } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const SignedOutCard = () => {
  const status = useAgentAuthStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  if (status?.loggedIn !== false) return null;

  const check = async () => {
    setChecking(true);
    try {
      const result = await checkAgentSignIn();
      if (result.signedIn) {
        toast({ title: 'Signed in', description: 'Paused runs are resuming.', variant: 'success' });
      } else {
        toast({
          title: result.signedIn === false ? 'Still signed out' : 'Could not confirm sign-in',
          description: result.reason ? oneLineErrorSummary(result.reason) : undefined,
          variant: 'warning',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not confirm sign-in',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setChecking(false);
      void refreshAgentAuthStatus();
    }
  };

  return (
    <Card surface="chalkboard" size="small">
      <div className="flex min-w-0 flex-col gap-2">
        <Tooltip
          content={status.reason ?? 'Agent runs wait until Claude is signed in.'}
          surface="chalkboard"
        >
          <span className="font-handwritten text-sm leading-tight text-desk-chalk">
            Claude needs you to sign in again
          </span>
        </Tooltip>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            surface="chalkboard"
            onClick={() =>
              navigate({ to: '/project/settings/$section', params: { section: 'setup' } })
            }
          >
            Sign in
          </Button>
          <Button
            size="small"
            variant="ghost"
            surface="chalkboard"
            disabled={checking}
            onClick={check}
          >
            {checking ? 'Checking…' : "I've signed in"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
