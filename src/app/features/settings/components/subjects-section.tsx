import { useSubjectVocabulary } from '@/app/hooks';
import { space } from '@/app/styles/tokens';
import { Button, Card, Divider } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export const SubjectsSection = () => {
  const { subjects, loading, available } = useSubjectVocabulary();
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: space[6] }}>
        <h2 style={{ margin: 0 }}>Subjects</h2>
        <p style={{ opacity: 0.5, marginTop: space[1] }}>
          Subjects are the roadmap's bets and standing concerns. Edit the vocabulary on the Roadmap
          page.
        </p>
      </div>
      {loading && <p>Loading…</p>}
      {!loading && !available && (
        <p style={{ opacity: 0.6, margin: 0 }}>Couldn't load subjects — check the server config.</p>
      )}
      {!loading && available && (
        <Card size="small" texture="kraft">
          {subjects.length === 0 && (
            <p style={{ opacity: 0.45, margin: 0, paddingBottom: space[2] }}>No subjects yet.</p>
          )}
          {subjects.map((name, idx) => (
            <div key={name}>
              <div style={{ paddingBottom: space[2], paddingTop: space[2] }}>{name}</div>
              {idx < subjects.length - 1 && <Divider />}
            </div>
          ))}
          {subjects.length > 0 && <Divider />}
          <div style={{ paddingTop: space[3] }}>
            <Button size="small" onClick={() => navigate({ to: '/roadmap' })}>
              Go to Roadmap
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
