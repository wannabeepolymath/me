import './styles.css';
import { renderFallback, fail } from './fallback';

const glTimer = renderFallback();
// Render the HTML deck first, so it also works when the scene chunk fails to load.
void import('./scene')
  .then(({ startScene }) => startScene(glTimer))
  .catch(() => fail(glTimer));
