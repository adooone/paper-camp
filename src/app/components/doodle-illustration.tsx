interface DoodleIllustrationProps {
  name: string;
}

// paper-ui has no illustration-fetch component; the doodle pack is a plain SVG file the
// hosted client fetches, so a build without it (PAPERCAMP_ASSETS_URL unset) 404s quietly.
export const DoodleIllustration = ({ name }: DoodleIllustrationProps) => (
  <img
    src={`/img/doodles/${name}.svg`}
    alt=""
    aria-hidden="true"
    className="h-24 w-24"
    onError={(event) => {
      event.currentTarget.style.display = 'none';
    }}
  />
);
